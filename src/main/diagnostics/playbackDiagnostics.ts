import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { powerMonitor, type BrowserWindow } from 'electron'
import log from 'electron-log/main.js'
import { getStoragePaths } from '../ipc/storagePaths/paths.ts'
import {
  PLAYBACK_DIAGNOSTICS_SCHEMA_VERSION,
  type PlaybackDiagnosticAppendPayload,
  type PlaybackDiagnosticDetailValue,
  type PlaybackDiagnosticEnvelope,
  type PlaybackDiagnosticLevel,
  type PlaybackDiagnosticName,
  type PlaybackDiagnosticSnapshot
} from '../Types/playbackDiagnostics.ts'
import type { PlaybackEventType, PlaybackRecordPayload } from '../Types/likeHandlers.ts'

const PLAYBACK_LOG_MAX_SIZE = 10 * 1024 * 1024
const FIELD_LIMIT = 4_096
const ERROR_LIMIT = 2_048
const DUPLICATE_RETENTION_MS = 30 * 60 * 1_000
const SHORT_VIEW_BURST_WINDOW_MS = 10 * 60 * 1_000
const MAX_TRACKED_KEYS = 5_000

const DIAGNOSTIC_NAMES = new Set<PlaybackDiagnosticName>([
  'run.start',
  'session.open',
  'session.reset',
  'session.finalize.start',
  'session.finalize.result',
  'audio.play',
  'audio.pause',
  'audio.seeked',
  'audio.ended',
  'audio.replay-detected',
  'renderer.visibility',
  'renderer.focus',
  'renderer.blur',
  'award.eligible',
  'award.request',
  'award.suppressed',
  'award.result',
  'ipc.receive',
  'db.commit',
  'db.failure',
  'toast.emit',
  'window.state',
  'system.suspend',
  'system.resume',
  'anomaly.duplicate-award-request',
  'anomaly.missing-correlation',
  'anomaly.short-view-burst',
  'anomaly.unexpected-increment',
  'export.start',
  'export.complete',
  'export.failure'
])

export const appRunId = randomUUID()

const playbackLog = log.create({ logId: 'playback-diagnostics' })
const duplicateAwards = new Map<string, { count: number; lastSeenAt: number }>()
const recentShortViewCommits = new Map<string, number[]>()
let initialized = false
let powerEventsRegistered = false
let lastWriteFailureAt = 0

type StatsRecord = Record<string, number | boolean | null | undefined>

function toLimitedString(value: unknown, limit = FIELD_LIMIT): string | null {
  if (typeof value !== 'string') return null
  return value.slice(0, limit)
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeOccurredAt(value: unknown, fallback: string): string {
  const candidate = toLimitedString(value, 64)
  if (!candidate) return fallback
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizeDetailsValue(value: unknown, depth = 0): PlaybackDiagnosticDetailValue {
  if (depth >= 4) return '[depth-limit]'
  if (value == null || typeof value === 'boolean') return value as boolean | null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value.slice(0, FIELD_LIMIT)
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => normalizeDetailsValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, item]) => [key.slice(0, 128), normalizeDetailsValue(item, depth + 1)])
    )
  }
  return String(value).slice(0, FIELD_LIMIT)
}

function normalizeSnapshot(value: unknown): PlaybackDiagnosticSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Record<string, unknown>
  const audio =
    snapshot.audio && typeof snapshot.audio === 'object'
      ? (snapshot.audio as Record<string, unknown>)
      : null
  const flags =
    snapshot.flags && typeof snapshot.flags === 'object'
      ? (snapshot.flags as Record<string, unknown>)
      : null
  const windowState =
    snapshot.window && typeof snapshot.window === 'object'
      ? (snapshot.window as Record<string, unknown>)
      : null

  return {
    visibilityState: toLimitedString(snapshot.visibilityState, 64),
    documentHasFocus: toNullableBoolean(snapshot.documentHasFocus),
    activeListeningSeconds: toFiniteNumber(snapshot.activeListeningSeconds),
    audio: audio
      ? {
          currentTime: toFiniteNumber(audio.currentTime),
          duration: toFiniteNumber(audio.duration),
          paused: toNullableBoolean(audio.paused),
          ended: toNullableBoolean(audio.ended),
          readyState: toFiniteNumber(audio.readyState),
          playbackRate: toFiniteNumber(audio.playbackRate)
        }
      : null,
    flags: flags
      ? {
          shortViewAwarded: Boolean(flags.shortViewAwarded),
          longViewAwarded: Boolean(flags.longViewAwarded),
          replayCyclePendingCompletionRepeat: Boolean(flags.replayCyclePendingCompletionRepeat),
          skipAwarded: Boolean(flags.skipAwarded),
          finalizing: Boolean(flags.finalizing),
          finalized: Boolean(flags.finalized)
        }
      : null,
    window: windowState
      ? {
          visible: toNullableBoolean(windowState.visible),
          minimized: toNullableBoolean(windowState.minimized),
          maximized: toNullableBoolean(windowState.maximized),
          focused: toNullableBoolean(windowState.focused),
          backgroundThrottling: toNullableBoolean(windowState.backgroundThrottling)
        }
      : null
  }
}

function normalizeLevel(value: unknown): PlaybackDiagnosticLevel {
  return value === 'debug' || value === 'warn' || value === 'error' ? value : 'info'
}

export function normalizePlaybackDiagnosticPayload(
  value: unknown,
  source: 'renderer' | 'main',
  webContentsId?: number | null
): PlaybackDiagnosticEnvelope | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = toLimitedString(input.name, 128) as PlaybackDiagnosticName | null
  if (!name || !DIAGNOSTIC_NAMES.has(name)) return null

  const loggedAt = new Date().toISOString()
  const details =
    input.details && typeof input.details === 'object'
      ? (normalizeDetailsValue(input.details) as Record<string, PlaybackDiagnosticDetailValue>)
      : undefined

  return {
    schemaVersion: PLAYBACK_DIAGNOSTICS_SCHEMA_VERSION,
    name,
    occurredAt: normalizeOccurredAt(input.occurredAt, loggedAt),
    loggedAt,
    appRunId,
    source,
    webContentsId: toFiniteNumber(webContentsId),
    level: normalizeLevel(input.level),
    sessionId: toLimitedString(input.sessionId),
    cycleId: toLimitedString(input.cycleId),
    requestId: toLimitedString(input.requestId),
    cycleSequence: toFiniteNumber(input.cycleSequence),
    eventSequence: toFiniteNumber(input.eventSequence),
    filePath: toLimitedString(input.filePath),
    songId: toFiniteNumber(input.songId),
    snapshot: normalizeSnapshot(input.snapshot),
    details
  } as PlaybackDiagnosticEnvelope
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true

  const { current } = getPlaybackDiagnosticsPaths()
  playbackLog.transports.file.level = 'debug'
  playbackLog.transports.file.maxSize = PLAYBACK_LOG_MAX_SIZE
  playbackLog.transports.file.format = '{text}'
  playbackLog.transports.file.resolvePathFn = () => current
  playbackLog.transports.console.level = false
  playbackLog.initialize()
}

export function getPlaybackDiagnosticsPaths(): { current: string; old: string } {
  const current = join(getStoragePaths().logsRoot, 'playback-diagnostics.log')
  return {
    current,
    old: current.replace(/\.log$/i, '.old.log')
  }
}

export function writePlaybackDiagnostic(
  payload: PlaybackDiagnosticAppendPayload,
  source: 'renderer' | 'main' = 'main',
  webContentsId?: number | null
): boolean {
  try {
    ensureInitialized()
    const normalized = normalizePlaybackDiagnosticPayload(payload, source, webContentsId)
    if (!normalized) return false
    playbackLog[normalized.level || 'info'](JSON.stringify(normalized))
    return true
  } catch (error) {
    const now = Date.now()
    if (now - lastWriteFailureAt >= 60_000) {
      lastWriteFailureAt = now
      const message = error instanceof Error ? error.message.slice(0, ERROR_LIMIT) : String(error)
      log.error('[playback diagnostics] Failed to write diagnostic event:', message)
    }
    return false
  }
}

export function createMainDiagnostic(
  name: PlaybackDiagnosticName,
  values: Partial<PlaybackDiagnosticAppendPayload> = {}
): PlaybackDiagnosticAppendPayload {
  return {
    schemaVersion: PLAYBACK_DIAGNOSTICS_SCHEMA_VERSION,
    name,
    occurredAt: new Date().toISOString(),
    ...values
  } as PlaybackDiagnosticAppendPayload
}

function getWindowSnapshot(window: BrowserWindow | null) {
  if (!window || window.isDestroyed()) return null
  return {
    visible: window.isVisible(),
    minimized: window.isMinimized(),
    maximized: window.isMaximized(),
    focused: window.isFocused(),
    backgroundThrottling: window.webContents.getBackgroundThrottling()
  }
}

export function recordPlaybackWindowState(window: BrowserWindow | null, cause: string): void {
  writePlaybackDiagnostic(
    createMainDiagnostic('window.state', {
      snapshot: { window: getWindowSnapshot(window) },
      details: { cause }
    })
  )
}

export function initializePlaybackDiagnostics(): void {
  ensureInitialized()
  writePlaybackDiagnostic(
    createMainDiagnostic('run.start', {
      details: {
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron || null,
        platform: process.platform,
        arch: process.arch
      }
    })
  )

  if (powerEventsRegistered) return
  powerEventsRegistered = true
  powerMonitor.on('suspend', () => {
    writePlaybackDiagnostic(createMainDiagnostic('system.suspend'))
  })
  powerMonitor.on('resume', () => {
    writePlaybackDiagnostic(createMainDiagnostic('system.resume'))
  })
}

function pruneDuplicateAwards(now: number): void {
  if (duplicateAwards.size <= MAX_TRACKED_KEYS) return
  for (const [key, value] of duplicateAwards) {
    if (
      now - value.lastSeenAt > DUPLICATE_RETENTION_MS ||
      duplicateAwards.size > MAX_TRACKED_KEYS
    ) {
      duplicateAwards.delete(key)
    }
  }
}

export function recordPlaybackIpcReceive(
  payload: PlaybackRecordPayload,
  eventType: PlaybackEventType | null,
  webContentsId?: number | null
): void {
  const base = createMainDiagnostic('ipc.receive', {
    requestId: payload.requestId,
    sessionId: payload.sessionId,
    cycleId: payload.cycleId,
    cycleSequence: toFiniteNumber(payload.cycleSequence),
    eventSequence: toFiniteNumber(payload.eventSequence),
    occurredAt: normalizeOccurredAt(payload.occurredAt, new Date().toISOString()),
    filePath: payload.filePath,
    snapshot: payload.diagnosticSnapshot,
    details: { eventType: eventType || 'invalid' }
  })
  writePlaybackDiagnostic(base, 'main', webContentsId)

  if (!payload.requestId || !payload.sessionId || !payload.cycleId) {
    writePlaybackDiagnostic(
      createMainDiagnostic('anomaly.missing-correlation', {
        ...base,
        name: 'anomaly.missing-correlation',
        level: 'warn',
        details: {
          eventType: eventType || 'invalid',
          missingRequestId: !payload.requestId,
          missingSessionId: !payload.sessionId,
          missingCycleId: !payload.cycleId
        }
      }),
      'main',
      webContentsId
    )
  }

  if (!payload.cycleId || !eventType) return
  const now = Date.now()
  const key = `${payload.cycleId}:${eventType}`
  const previous = duplicateAwards.get(key)
  const nextCount = (previous?.count || 0) + 1
  duplicateAwards.set(key, { count: nextCount, lastSeenAt: now })
  pruneDuplicateAwards(now)

  if (nextCount > 1) {
    writePlaybackDiagnostic(
      createMainDiagnostic('anomaly.duplicate-award-request', {
        ...base,
        name: 'anomaly.duplicate-award-request',
        level: 'warn',
        details: { eventType, duplicateCount: nextCount }
      }),
      'main',
      webContentsId
    )
  }
}

function pruneShortViewCommits(now: number): void {
  if (recentShortViewCommits.size <= MAX_TRACKED_KEYS) return
  for (const [path, timestamps] of recentShortViewCommits) {
    const latest = timestamps.at(-1) || 0
    if (
      now - latest > SHORT_VIEW_BURST_WINDOW_MS ||
      recentShortViewCommits.size > MAX_TRACKED_KEYS
    ) {
      recentShortViewCommits.delete(path)
    }
  }
}

export function recordPlaybackDatabaseFailure(
  payload: PlaybackRecordPayload,
  eventType: PlaybackEventType | null,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  writePlaybackDiagnostic(
    createMainDiagnostic('db.failure', {
      level: 'error',
      requestId: payload.requestId,
      sessionId: payload.sessionId,
      cycleId: payload.cycleId,
      filePath: payload.filePath,
      details: { eventType: eventType || 'invalid', error: message.slice(0, ERROR_LIMIT) }
    })
  )
}

export function recordPlaybackDatabaseCommit(input: {
  payload: PlaybackRecordPayload
  eventType: PlaybackEventType
  songId: number
  requestedDelta: Record<string, number>
  statsBefore: StatsRecord | null
  statsAfter: StatsRecord
  playHistory: { id: number; timestamp: string } | null
}): void {
  const { payload, eventType, songId, requestedDelta, statsBefore, statsAfter, playHistory } = input
  const base = createMainDiagnostic('db.commit', {
    requestId: payload.requestId,
    sessionId: payload.sessionId,
    cycleId: payload.cycleId,
    cycleSequence: toFiniteNumber(payload.cycleSequence),
    eventSequence: toFiniteNumber(payload.eventSequence),
    filePath: payload.filePath,
    songId,
    details: {
      eventType,
      requestedDelta,
      statsBefore: statsBefore || {},
      statsAfter,
      playHistoryId: playHistory?.id || null,
      playHistoryTimestamp: playHistory?.timestamp || null
    }
  })
  writePlaybackDiagnostic(base)

  const mismatches = Object.entries(requestedDelta).filter(([field, delta]) => {
    const before = Number(statsBefore?.[field] || 0)
    const after = Number(statsAfter[field] || 0)
    return !Number.isFinite(after) || Math.abs(after - before - delta) > 0.000_001
  })

  if (mismatches.length > 0) {
    writePlaybackDiagnostic(
      createMainDiagnostic('anomaly.unexpected-increment', {
        ...base,
        name: 'anomaly.unexpected-increment',
        level: 'warn',
        details: {
          eventType,
          mismatchedFields: mismatches.map(([field]) => field),
          requestedDelta,
          statsBefore: statsBefore || {},
          statsAfter
        }
      })
    )
  }

  if (eventType !== 'short-view-award' || !payload.filePath) return
  const now = Date.now()
  const recent = (recentShortViewCommits.get(payload.filePath) || []).filter(
    (timestamp) => now - timestamp <= SHORT_VIEW_BURST_WINDOW_MS
  )
  recent.push(now)
  recentShortViewCommits.set(payload.filePath, recent)
  pruneShortViewCommits(now)

  if (recent.length === 5 || recent.length % 5 === 0) {
    writePlaybackDiagnostic(
      createMainDiagnostic('anomaly.short-view-burst', {
        ...base,
        name: 'anomaly.short-view-burst',
        level: 'warn',
        details: {
          eventType,
          commitsInWindow: recent.length,
          windowSeconds: SHORT_VIEW_BURST_WINDOW_MS / 1000
        }
      })
    )
  }
}

export function resetPlaybackDiagnosticsForTests(): void {
  duplicateAwards.clear()
  recentShortViewCommits.clear()
  lastWriteFailureAt = 0
}

export function getPlaybackDiagnosticLoggerForTests() {
  return playbackLog
}
