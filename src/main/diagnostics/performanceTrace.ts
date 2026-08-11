import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BrowserWindow, contentTracing } from 'electron'
import log from 'electron-log/main.js'
import { getStoragePaths } from '../ipc/storagePaths/paths.ts'
import type {
  PerformanceTraceStartResult,
  PerformanceTraceStatus
} from '../Types/performanceDiagnostics.ts'
import {
  createPerformanceDiagnostic,
  writePerformanceDiagnostic
} from './performanceDiagnostics.ts'

const TRACE_DURATION_MS = 5 * 60_000
const TRACE_STOP_TIMEOUT_MS = 20_000
const TRACE_BUFFER_KB = 64 * 1024
const TRACE_STATE_CHANNEL = 'performance-diagnostics:state'

let status: PerformanceTraceStatus = {
  state: 'off',
  mode: null,
  startedAt: null,
  deadlineAt: null,
  capturedAt: null,
  filePath: null,
  error: null
}
let stopTimer: NodeJS.Timeout | null = null
let stopPromise: Promise<PerformanceTraceStatus> | null = null

export function getPerformanceTracePaths(): {
  captured: string
  partial: string
  armedState: string
} {
  const storage = getStoragePaths()
  return {
    captured: join(storage.logsRoot, 'performance-trace.json'),
    partial: join(storage.logsRoot, 'performance-trace.partial.json'),
    armedState: join(storage.userDataRoot, 'performance-trace-armed.json')
  }
}

function publishStatus(): void {
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('trace.state', {
      level: status.state === 'failed' ? 'error' : 'info',
      details: { ...status }
    })
  )
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(TRACE_STATE_CHANNEL, status)
    }
  }
}

function setStatus(next: PerformanceTraceStatus): PerformanceTraceStatus {
  status = next
  publishStatus()
  return { ...status }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function persistArmedState(): Promise<void> {
  const { armedState } = getPerformanceTracePaths()
  await mkdir(dirname(armedState), { recursive: true })
  await writeFile(
    armedState,
    `${JSON.stringify({ schemaVersion: 1, armedAt: new Date().toISOString() })}\n`,
    'utf8'
  )
}

async function clearArmedState(): Promise<void> {
  await rm(getPerformanceTracePaths().armedState, { force: true })
}

async function startRecording(mode: 'now' | 'next-launch'): Promise<PerformanceTraceStartResult> {
  if (status.state === 'recording' || status.state === 'saving') {
    return {
      success: false,
      status: { ...status },
      error: 'A performance trace is already active.'
    }
  }

  const startedAt = new Date()
  try {
    await contentTracing.startRecording({
      recording_mode: 'record-continuously',
      trace_buffer_size_in_kb: TRACE_BUFFER_KB,
      enable_argument_filter: true,
      included_categories: [
        'electron',
        'toplevel',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        'v8.execute',
        'blink.console',
        'blink.user_timing',
        'latencyInfo'
      ],
      excluded_categories: ['*']
    })
    await clearArmedState().catch(() => undefined)
    setStatus({
      state: 'recording',
      mode,
      startedAt: startedAt.toISOString(),
      deadlineAt: new Date(startedAt.getTime() + TRACE_DURATION_MS).toISOString(),
      capturedAt: null,
      filePath: null,
      error: null
    })
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = setTimeout(
      () => void stopPerformanceTrace('five-minute-timeout'),
      TRACE_DURATION_MS
    )
    stopTimer.unref()
    return { success: true, status: { ...status } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus({
      state: 'failed',
      mode,
      startedAt: null,
      deadlineAt: null,
      capturedAt: null,
      filePath: null,
      error: message.slice(0, 2_048)
    })
    return { success: false, status: { ...status }, error: message }
  }
}

export async function startPerformanceTrace(
  mode: 'now' | 'next-launch'
): Promise<PerformanceTraceStartResult> {
  if (status.state === 'recording' || status.state === 'saving') {
    return {
      success: false,
      status: { ...status },
      error: 'A performance trace is already active.'
    }
  }
  if (mode === 'next-launch') {
    try {
      await persistArmedState()
      setStatus({
        state: 'armed',
        mode,
        startedAt: null,
        deadlineAt: null,
        capturedAt: status.capturedAt,
        filePath: status.filePath,
        error: null
      })
      return { success: true, status: { ...status } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ ...status, state: 'failed', mode, error: message.slice(0, 2_048) })
      return { success: false, status: { ...status }, error: message }
    }
  }
  return startRecording('now')
}

export async function stopPerformanceTrace(reason = 'manual'): Promise<PerformanceTraceStatus> {
  if (stopPromise) return stopPromise
  if (status.state !== 'recording') return { ...status }
  if (stopTimer) clearTimeout(stopTimer)
  stopTimer = null
  const previous = { ...status }
  setStatus({ ...status, state: 'saving', deadlineAt: null })

  stopPromise = (async () => {
    const paths = getPerformanceTracePaths()
    await mkdir(dirname(paths.partial), { recursive: true })
    await rm(paths.partial, { force: true }).catch(() => undefined)
    const recordingStop = contentTracing.stopRecording(paths.partial)
    let timeout: NodeJS.Timeout | null = null
    try {
      const outputPath = await Promise.race([
        recordingStop,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Trace save exceeded ${TRACE_STOP_TIMEOUT_MS}ms.`)),
            TRACE_STOP_TIMEOUT_MS
          )
        })
      ])
      if (timeout) clearTimeout(timeout)
      if (!(await fileExists(outputPath)))
        throw new Error('Electron did not create the trace file.')
      await rm(paths.captured, { force: true })
      await rename(outputPath, paths.captured)
      return setStatus({
        state: 'captured',
        mode: previous.mode,
        startedAt: previous.startedAt,
        deadlineAt: null,
        capturedAt: new Date().toISOString(),
        filePath: paths.captured,
        error: null
      })
    } catch (error) {
      if (timeout) clearTimeout(timeout)
      const message = error instanceof Error ? error.message : String(error)
      void recordingStop.then(
        () => rm(paths.partial, { force: true }).catch(() => undefined),
        () => rm(paths.partial, { force: true }).catch(() => undefined)
      )
      log.error('[performance diagnostics] Trace save failed:', message)
      return setStatus({
        state: 'failed',
        mode: previous.mode,
        startedAt: previous.startedAt,
        deadlineAt: null,
        capturedAt: null,
        filePath: null,
        error: `${reason}: ${message}`.slice(0, 2_048)
      })
    } finally {
      stopPromise = null
    }
  })()
  return stopPromise
}

export async function initializePerformanceTrace(): Promise<PerformanceTraceStatus> {
  const paths = getPerformanceTracePaths()
  const [armed, captured] = await Promise.all([
    readFile(paths.armedState, 'utf8')
      .then(() => true)
      .catch(() => false),
    fileExists(paths.captured)
  ])
  if (armed) {
    await startRecording('next-launch')
    return { ...status }
  }
  if (captured) {
    setStatus({
      state: 'captured',
      mode: null,
      startedAt: null,
      deadlineAt: null,
      capturedAt: null,
      filePath: paths.captured,
      error: null
    })
  }
  return { ...status }
}

export function getPerformanceTraceStatus(): PerformanceTraceStatus {
  return { ...status }
}

export function resetPerformanceTraceForTests(): void {
  if (stopTimer) clearTimeout(stopTimer)
  stopTimer = null
  stopPromise = null
  status = {
    state: 'off',
    mode: null,
    startedAt: null,
    deadlineAt: null,
    capturedAt: null,
    filePath: null,
    error: null
  }
}
