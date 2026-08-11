import { createReadStream, createWriteStream } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { arch, platform, release } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { app, dialog, type BrowserWindow } from 'electron'
import log from 'electron-log/main.js'
import JSZip from 'jszip'
import { getStoragePaths } from '../ipc/storagePaths/paths.ts'
import { getPrismaClient, getPrismaStatus } from '../prisma.ts'
import type { PlaybackDiagnosticsExportResult } from '../Types/playbackDiagnostics.ts'
import {
  appRunId,
  createMainDiagnostic,
  getPlaybackDiagnosticsPaths,
  writePlaybackDiagnostic
} from './playbackDiagnostics.ts'
import {
  createPerformanceDiagnostic,
  getPerformanceDiagnosticsPaths,
  getPerformanceDiagnosticsSnapshot,
  PERFORMANCE_CPU_THRESHOLD,
  PERFORMANCE_EVENT_LOOP_DELAY_MS,
  PERFORMANCE_LOG_MAX_SIZE,
  PERFORMANCE_MEMORY_ABSOLUTE_KB,
  PERFORMANCE_MEMORY_GROWTH_KB,
  PERFORMANCE_RING_BUFFER_MS,
  PERFORMANCE_SAMPLE_INTERVAL_MS,
  PERFORMANCE_SLOW_OPERATION_MS,
  writePerformanceDiagnostic
} from './performanceDiagnostics.ts'
import { getPerformanceTracePaths, getPerformanceTraceStatus } from './performanceTrace.ts'

const SUMMARY_LIMIT = 50

async function existingFile(path: string): Promise<string | null> {
  try {
    const file = await stat(path)
    return file.isFile() ? path : null
  } catch {
    return null
  }
}

function getGeneralLogPaths(logsRoot: string): { current: string; old: string } {
  try {
    const current = log.transports.file.getFile().path
    return { current, old: current.replace(/\.log$/i, '.old.log') }
  } catch {
    const current = join(logsRoot, 'main.log')
    return { current, old: join(logsRoot, 'main.old.log') }
  }
}

export async function buildPlaybackDiagnosticsSummary(): Promise<{
  generatedAt: string
  limit: number
  tracks: Array<Record<string, unknown>>
  unavailableReason?: string
}> {
  const generatedAt = new Date().toISOString()
  const status = getPrismaStatus()

  if (!status.isReady) {
    return {
      generatedAt,
      limit: SUMMARY_LIMIT,
      tracks: [],
      unavailableReason: status.error?.message || 'Database is not ready.'
    }
  }

  const db = getPrismaClient()
  const preferences = await db.userPreferences.findMany({
    orderBy: [{ short_view_count: 'desc' }, { song_id: 'asc' }],
    take: SUMMARY_LIMIT,
    select: {
      song_id: true,
      play_count: true,
      skip_count: true,
      short_view_count: true,
      long_view_count: true,
      long_play_seconds: true,
      active_listening_seconds: true,
      consecutive_repeat_count: true,
      Songs: {
        select: {
          filepath: true,
          filename: true,
          title: true,
          artist: true,
          album: true,
          duration: true,
          timestamp: true
        }
      }
    }
  })
  const songIds = preferences.map((item) => item.song_id)
  const history =
    songIds.length === 0
      ? []
      : await db.playHistory.groupBy({
          by: ['song_id'],
          where: { song_id: { in: songIds } },
          _count: { _all: true },
          _min: { timestamp: true },
          _max: { timestamp: true }
        })
  const historyBySong = new Map(history.map((item) => [item.song_id, item]))

  return {
    generatedAt,
    limit: SUMMARY_LIMIT,
    tracks: preferences.map(({ Songs, ...metrics }) => {
      const aggregate = historyBySong.get(metrics.song_id)
      return {
        ...metrics,
        filePath: Songs.filepath,
        fileName: Songs.filename,
        title: Songs.title,
        artist: Songs.artist,
        album: Songs.album,
        duration: Songs.duration,
        libraryAddedAt: Songs.timestamp.toISOString(),
        playHistoryCount: aggregate?._count._all || 0,
        firstPlayHistoryAt: aggregate?._min.timestamp?.toISOString() || null,
        lastPlayHistoryAt: aggregate?._max.timestamp?.toISOString() || null
      }
    })
  }
}

function getWindowState(window: BrowserWindow | null) {
  if (!window || window.isDestroyed()) return null
  return {
    visible: window.isVisible(),
    minimized: window.isMinimized(),
    maximized: window.isMaximized(),
    focused: window.isFocused(),
    backgroundThrottling: window.webContents.getBackgroundThrottling(),
    bounds: window.getBounds()
  }
}

function createReadme(): string {
  return `Elevate application diagnostics\n\n\
The playback-diagnostics*.log files are NDJSON: one JSON event per line.\n\
The performance-diagnostics*.log files contain startup spans, process samples, renderer stalls,\n\
Web Audio state, signal summaries, and trace lifecycle events.\n\
Use appRunId to separate application launches, sessionId for a selected track, cycleId for one\n\
play/replay cycle, requestId for one IPC request, and eventSequence to reconstruct renderer order.\n\n\
Important events:\n\
- award.request -> ipc.receive -> db.commit -> award.result -> toast.emit\n\
- anomaly.duplicate-award-request means the same cycle/eventType reached main more than once.\n\
- anomaly.short-view-burst means at least five short-view commits occurred for a path in 10 minutes.\n\
- window.state, renderer.visibility, system.suspend and system.resume explain background periods.\n\n\
Full local file paths are intentionally included. The SQLite database itself is not included.\n`
}

export function buildPerformanceDiagnosticsSummary(): Record<string, unknown> {
  const snapshot = getPerformanceDiagnosticsSnapshot()
  const startup = snapshot.summaryEvents.filter(
    (event) => event.name === 'startup.milestone' || event.name === 'renderer.ready'
  )
  const hangs = snapshot.summaryEvents.filter((event) =>
    ['renderer.stall-suspected', 'renderer.unresponsive', 'renderer.responsive'].includes(
      event.name
    )
  )
  const audioIncidents = snapshot.summaryEvents.filter((event) =>
    ['audio.no-sound-incident', 'audio.context-resume-result', 'audio.graph-failure'].includes(
      event.name
    )
  )
  const slowOperations = snapshot.summaryEvents
    .filter((event) => event.name === 'operation.end')
    .sort(
      (left, right) =>
        Number(right.details?.durationMs || 0) - Number(left.details?.durationMs || 0)
    )
    .slice(0, 50)
  const processPeaks = new Map<number, { cpuPercent: number; workingSetKb: number; type: string }>()
  for (const sample of snapshot.recentMetrics) {
    for (const metric of sample.processes) {
      const previous = processPeaks.get(metric.pid)
      processPeaks.set(metric.pid, {
        cpuPercent: Math.max(previous?.cpuPercent || 0, metric.cpuPercent),
        workingSetKb: Math.max(previous?.workingSetKb || 0, metric.workingSetKb || 0),
        type: metric.type
      })
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    startup,
    hangs,
    audioIncidents,
    slowOperations,
    processPeaks: [...processPeaks.entries()].map(([pid, peak]) => ({ pid, ...peak })),
    recentMetrics: snapshot.recentMetrics,
    rendererHeartbeats: snapshot.heartbeats
  }
}

export async function exportPlaybackDiagnostics(
  window: BrowserWindow | null
): Promise<PlaybackDiagnosticsExportResult> {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const suggestedName = `Elevate-diagnostics-${timestamp}.zip`
  const dialogOptions = {
    title: 'Export application diagnostics',
    defaultPath: join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
  }
  const selection = window
    ? await dialog.showSaveDialog(window, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)

  if (selection.canceled || !selection.filePath) {
    return { success: false, code: 'canceled', error: '' }
  }

  const outputPath = selection.filePath
  writePlaybackDiagnostic(createMainDiagnostic('export.start', { details: { outputPath } }))
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('export.start', { details: { outputPath } })
  )

  try {
    const storagePaths = getStoragePaths()
    const playbackPaths = getPlaybackDiagnosticsPaths()
    const performancePaths = getPerformanceDiagnosticsPaths()
    const tracePaths = getPerformanceTracePaths()
    const generalPaths = getGeneralLogPaths(storagePaths.logsRoot)
    const candidateLogs = [
      { archiveName: basename(playbackPaths.current), path: playbackPaths.current },
      { archiveName: basename(playbackPaths.old), path: playbackPaths.old },
      { archiveName: basename(performancePaths.current), path: performancePaths.current },
      { archiveName: basename(performancePaths.old), path: performancePaths.old },
      { archiveName: `general-${basename(generalPaths.current)}`, path: generalPaths.current },
      { archiveName: `general-${basename(generalPaths.old)}`, path: generalPaths.old },
      { archiveName: basename(tracePaths.captured), path: tracePaths.captured, trace: true }
    ]
    const [summary, ...resolvedLogs] = await Promise.all([
      buildPlaybackDiagnosticsSummary(),
      ...candidateLogs.map(({ path }) => existingFile(path))
    ])
    const includedLogs = candidateLogs
      .map((candidate, index) => ({ ...candidate, exists: Boolean(resolvedLogs[index]) }))
      .filter((candidate) => candidate.exists)
    const manifest = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appRunId,
      app: {
        name: app.getName(),
        version: app.getVersion(),
        packaged: app.isPackaged
      },
      runtime: {
        electron: process.versions.electron || null,
        chrome: process.versions.chrome || null,
        node: process.versions.node
      },
      system: { platform: platform(), release: release(), arch: arch() },
      paths: storagePaths,
      databaseStatus: getPrismaStatus(),
      window: getWindowState(window),
      logging: {
        schemaVersion: 1,
        playbackMaxFileBytes: 10 * 1024 * 1024,
        playbackRetentionFiles: 2,
        performanceMaxFileBytes: PERFORMANCE_LOG_MAX_SIZE,
        performanceRetentionFiles: 2,
        sampleIntervalMs: PERFORMANCE_SAMPLE_INTERVAL_MS,
        ringBufferMs: PERFORMANCE_RING_BUFFER_MS,
        slowOperationThresholdMs: PERFORMANCE_SLOW_OPERATION_MS,
        cpuThresholdPercent: PERFORMANCE_CPU_THRESHOLD,
        memoryGrowthThresholdKb: PERFORMANCE_MEMORY_GROWTH_KB,
        memoryAbsoluteThresholdKb: PERFORMANCE_MEMORY_ABSOLUTE_KB,
        eventLoopDelayThresholdMs: PERFORMANCE_EVENT_LOOP_DELAY_MS,
        shortViewBurstThreshold: 5,
        shortViewBurstWindowSeconds: 600,
        includedLogs,
        missingLogs: candidateLogs.filter((_candidate, index) => !resolvedLogs[index])
      },
      performanceTrace: getPerformanceTraceStatus()
    }

    const zip = new JSZip()
    for (const { archiveName, path, trace } of includedLogs) {
      zip.file(trace ? `traces/${archiveName}` : `logs/${archiveName}`, createReadStream(path))
    }
    zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
    zip.file('playback-summary.json', `${JSON.stringify(summary, null, 2)}\n`)
    zip.file(
      'performance-summary.json',
      `${JSON.stringify(buildPerformanceDiagnosticsSummary(), null, 2)}\n`
    )
    zip.file('README.txt', createReadme())

    await pipeline(
      zip.generateNodeStream({
        type: 'nodebuffer',
        streamFiles: true,
        compression: 'STORE'
      }),
      createWriteStream(outputPath)
    )

    writePlaybackDiagnostic(
      createMainDiagnostic('export.complete', {
        details: { outputPath, includedLogCount: includedLogs.length }
      })
    )
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('export.complete', {
        details: { outputPath, includedFileCount: includedLogs.length }
      })
    )
    return { success: true, filePath: outputPath }
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error || 'Export failed')
    writePlaybackDiagnostic(
      createMainDiagnostic('export.failure', {
        level: 'error',
        details: { outputPath, error: message.slice(0, 2_048) }
      })
    )
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('export.failure', {
        level: 'error',
        details: { outputPath, error: message.slice(0, 2_048) }
      })
    )
    log.error('[playback diagnostics] Export failed:', message)
    return { success: false, code: 'export-failed', error: message }
  }
}
