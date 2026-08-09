import log from 'electron-log/main.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMainDiagnostic,
  getPlaybackDiagnosticLoggerForTests,
  normalizePlaybackDiagnosticPayload,
  recordPlaybackDatabaseCommit,
  recordPlaybackIpcReceive,
  resetPlaybackDiagnosticsForTests,
  writePlaybackDiagnostic
} from '../../src/main/diagnostics/playbackDiagnostics.ts'
import { normalizePlaybackRecordPayload } from '../../src/main/ipc/likehandlers/playback.ts'

function diagnosticLogger() {
  return getPlaybackDiagnosticLoggerForTests()
}

function loggedEvents() {
  const logger = diagnosticLogger()
  return ['debug', 'info', 'warn', 'error'].flatMap((level) =>
    logger[level].mock.calls.map(([line]) => JSON.parse(line))
  )
}

function request(overrides = {}) {
  return {
    filePath: 'C:\\Music\\song.mp3',
    eventType: 'short-view-award',
    requestId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    cycleId: crypto.randomUUID(),
    cycleSequence: 1,
    eventSequence: 2,
    occurredAt: new Date().toISOString(),
    ...overrides
  }
}

beforeEach(() => {
  resetPlaybackDiagnosticsForTests()
  const logger = diagnosticLogger()
  for (const level of ['debug', 'info', 'warn', 'error']) logger[level].mockClear()
})

describe('playback diagnostic logging', () => {
  it('validates and bounds playback IPC payloads before database use', () => {
    expect(normalizePlaybackRecordPayload(null)).toMatchObject({
      filePath: null,
      eventType: null,
      requestId: null,
      countAsRepeat: false
    })
    const normalized = normalizePlaybackRecordPayload({
      filePath: 'C:\\Music\\song.mp3',
      eventType: 'short-view-award',
      requestId: 'r'.repeat(300),
      cycleSequence: '3',
      occurredAt: 'not-a-date',
      countAsRepeat: 'true'
    })
    expect(normalized).toMatchObject({
      filePath: 'C:\\Music\\song.mp3',
      eventType: 'short-view-award',
      cycleSequence: 3,
      occurredAt: null,
      countAsRepeat: false
    })
    expect(normalized.requestId).toHaveLength(128)
  })

  it('normalizes one-line JSON payloads and limits untrusted renderer fields', () => {
    const normalized = normalizePlaybackDiagnosticPayload(
      {
        schemaVersion: 99,
        name: 'award.request',
        occurredAt: 'invalid-date',
        requestId: 'request\nwith-newline',
        filePath: `C:\\Music\\${'x'.repeat(5_000)}.mp3`,
        details: { error: `failure\n${'y'.repeat(5_000)}` }
      },
      'renderer',
      12
    )

    expect(normalized.schemaVersion).toBe(1)
    expect(normalized.filePath.length).toBe(4_096)
    expect(normalized.details.error.length).toBe(4_096)
    expect(normalized.loggedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)
  })

  it('writes NDJSON through a dedicated 10 MiB rotating logger', () => {
    expect(writePlaybackDiagnostic(createMainDiagnostic('run.start'))).toBe(true)
    const logger = diagnosticLogger()
    const [line] = logger.info.mock.calls.at(-1)

    expect(() => JSON.parse(line)).not.toThrow()
    expect(line).not.toContain('\n')
    expect(logger.transports.file.maxSize).toBe(10 * 1024 * 1024)
    expect(logger.transports.file.format).toBe('{text}')
    expect(logger.transports.file.resolvePathFn()).toMatch(/playback-diagnostics\.log$/)
  })

  it('correlates and warns for two requests of the same cycle and event type', () => {
    const payload = request()
    recordPlaybackIpcReceive(payload, 'short-view-award', 4)
    recordPlaybackIpcReceive({ ...payload, requestId: crypto.randomUUID() }, 'short-view-award', 4)

    const duplicates = loggedEvents().filter(
      (event) => event.name === 'anomaly.duplicate-award-request'
    )
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]).toMatchObject({
      cycleId: payload.cycleId,
      details: { eventType: 'short-view-award', duplicateCount: 2 }
    })
  })

  it('distinguishes many legitimate cycles from many requests for one cycle', () => {
    for (let index = 0; index < 50; index += 1) {
      recordPlaybackIpcReceive(
        request({ cycleId: crypto.randomUUID(), cycleSequence: index + 1 }),
        'short-view-award'
      )
    }
    expect(
      loggedEvents().filter((event) => event.name === 'anomaly.duplicate-award-request')
    ).toHaveLength(0)

    resetPlaybackDiagnosticsForTests()
    const cycleId = crypto.randomUUID()
    for (let index = 0; index < 50; index += 1) {
      recordPlaybackIpcReceive(request({ cycleId }), 'short-view-award')
    }
    expect(
      loggedEvents().filter((event) => event.name === 'anomaly.duplicate-award-request')
    ).toHaveLength(49)
  })

  it('emits a burst warning after five committed short views for a full path', () => {
    const payload = request()
    for (let index = 0; index < 5; index += 1) {
      recordPlaybackDatabaseCommit({
        payload: { ...payload, cycleId: crypto.randomUUID(), requestId: crypto.randomUUID() },
        eventType: 'short-view-award',
        songId: 7,
        requestedDelta: { short_view_count: 1, play_count: 1 },
        statsBefore: { short_view_count: index, play_count: index },
        statsAfter: { short_view_count: index + 1, play_count: index + 1 },
        playHistory: { id: index + 1, timestamp: new Date().toISOString() }
      })
    }

    const warnings = loggedEvents().filter((event) => event.name === 'anomaly.short-view-burst')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      filePath: payload.filePath,
      songId: 7,
      details: { commitsInWindow: 5, windowSeconds: 600 }
    })
  })

  it('keeps minimize, background track commits, toasts and restore in reconstructable order', () => {
    const sessionId = crypto.randomUUID()
    writePlaybackDiagnostic(
      createMainDiagnostic('window.state', { details: { cause: 'minimize' } })
    )

    for (let index = 0; index < 2; index += 1) {
      const payload = request({
        sessionId,
        cycleId: crypto.randomUUID(),
        cycleSequence: index + 1,
        eventSequence: index * 4 + 1
      })
      writePlaybackDiagnostic(
        createMainDiagnostic('session.open', {
          sessionId,
          cycleId: payload.cycleId,
          eventSequence: payload.eventSequence,
          filePath: payload.filePath,
          details: { backgroundTrackIndex: index }
        }),
        'renderer'
      )
      recordPlaybackDatabaseCommit({
        payload,
        eventType: 'short-view-award',
        songId: index + 1,
        requestedDelta: { short_view_count: 1, play_count: 1 },
        statsBefore: { short_view_count: 0, play_count: 0 },
        statsAfter: { short_view_count: 1, play_count: 1 },
        playHistory: { id: index + 1, timestamp: new Date().toISOString() }
      })
      writePlaybackDiagnostic(
        createMainDiagnostic('toast.emit', {
          sessionId,
          cycleId: payload.cycleId,
          requestId: payload.requestId,
          eventSequence: payload.eventSequence + 3,
          filePath: payload.filePath,
          details: { eventType: 'short-view-award' }
        }),
        'renderer'
      )
    }

    writePlaybackDiagnostic(createMainDiagnostic('window.state', { details: { cause: 'restore' } }))
    const orderedNames = diagnosticLogger().info.mock.calls.map(([line]) => JSON.parse(line).name)
    expect(orderedNames).toEqual([
      'window.state',
      'session.open',
      'db.commit',
      'toast.emit',
      'session.open',
      'db.commit',
      'toast.emit',
      'window.state'
    ])
  })

  it('is fail-open when the diagnostic transport throws', () => {
    const logger = diagnosticLogger()
    logger.info.mockImplementationOnce(() => {
      throw new Error('disk unavailable')
    })

    expect(writePlaybackDiagnostic(createMainDiagnostic('run.start'))).toBe(false)
    expect(log.error).toHaveBeenCalled()
  })
})
