import { randomUUID } from './runtimeIds'
import {
  PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
  type PerformanceDiagnosticAppendPayload,
  type PerformanceDiagnosticName,
  type RendererHeartbeatPayload
} from '../../../main/Types/performanceDiagnostics.ts'

const VISIBLE_HEARTBEAT_MS = 2_000
const HIDDEN_HEARTBEAT_MS = 10_000
const LONG_TASK_LOG_THRESHOLD_MS = 250

type MemoryPerformance = Performance & {
  memory?: {
    usedJSHeapSize?: number
    totalJSHeapSize?: number
    jsHeapSizeLimit?: number
  }
}

let initialized = false
let heartbeatTimer: number | null = null
let activeOperation: string | null = null
let longTaskCount = 0
let longTaskTotalDurationMs = 0
let longTaskMaxDurationMs = 0

export function appendPerformanceEvent(
  name: PerformanceDiagnosticName,
  values: Partial<PerformanceDiagnosticAppendPayload> = {}
): void {
  if (typeof window === 'undefined' || !window.electron?.appDiagnostics?.appendPerformanceEvent) {
    return
  }
  window.electron.appDiagnostics.appendPerformanceEvent({
    schemaVersion: PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
    name,
    occurredAt: new Date().toISOString(),
    processType: 'renderer',
    ...values
  } as PerformanceDiagnosticAppendPayload)
}

function currentRoute(): string {
  return `${window.location.pathname}${window.location.hash}`.slice(0, 512)
}

function heapSnapshot(): RendererHeartbeatPayload['jsHeap'] {
  const memory = (performance as MemoryPerformance).memory
  if (!memory) return null
  const finite = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : null)
  return {
    usedBytes: finite(memory.usedJSHeapSize),
    totalBytes: finite(memory.totalJSHeapSize),
    limitBytes: finite(memory.jsHeapSizeLimit)
  }
}

function sendHeartbeat(): void {
  window.electron.appDiagnostics.reportRendererHeartbeat({
    schemaVersion: PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    route: currentRoute(),
    visibilityState: document.visibilityState,
    documentHasFocus: document.hasFocus(),
    longTasks: {
      count: longTaskCount,
      totalDurationMs: longTaskTotalDurationMs,
      maxDurationMs: longTaskMaxDurationMs
    },
    jsHeap: heapSnapshot(),
    activeOperation
  })
  longTaskCount = 0
  longTaskTotalDurationMs = 0
  longTaskMaxDurationMs = 0
  const delay = document.visibilityState === 'visible' ? VISIBLE_HEARTBEAT_MS : HIDDEN_HEARTBEAT_MS
  heartbeatTimer = window.setTimeout(sendHeartbeat, delay)
}

function observeLongTasks(): void {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskCount += 1
        longTaskTotalDurationMs += entry.duration
        longTaskMaxDurationMs = Math.max(longTaskMaxDurationMs, entry.duration)
        if (entry.duration >= LONG_TASK_LOG_THRESHOLD_MS) {
          appendPerformanceEvent('renderer.long-task', {
            level: 'warn',
            details: {
              durationMs: entry.duration,
              startTimeMs: entry.startTime,
              route: currentRoute(),
              activeOperation
            }
          })
        }
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
  } catch {
    // Older Chromium builds can reject this observer type; heartbeat still detects stalls.
  }
}

async function reportAudioOutputCount(cause: string): Promise<void> {
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices?.()
    appendPerformanceEvent('audio.device-change', {
      details: {
        cause,
        audioOutputCount: devices?.filter((device) => device.kind === 'audiooutput').length || 0
      }
    })
  } catch (error) {
    appendPerformanceEvent('audio.device-change', {
      level: 'warn',
      details: {
        cause,
        error: error instanceof Error ? error.message : String(error)
      }
    })
  }
}

export function startRendererPerformanceDiagnostics(): void {
  if (initialized) return
  initialized = true
  appendPerformanceEvent('startup.milestone', {
    details: {
      milestone: 'renderer.script-start',
      timeOrigin: performance.timeOrigin,
      navigationStartToScriptMs: performance.now()
    }
  })
  observeLongTasks()
  sendHeartbeat()
  void reportAudioOutputCount('startup')
  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    void reportAudioOutputCount('devicechange')
  })
}

export function markRendererMounted(): void {
  appendPerformanceEvent('startup.milestone', {
    details: { milestone: 'renderer.react-root-mounted', elapsedMs: performance.now() }
  })
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      appendPerformanceEvent('renderer.ready', {
        details: { milestone: 'renderer.second-animation-frame', elapsedMs: performance.now() }
      })
    })
  })
}

export function beginRendererOperation(
  operationName: string,
  details: Record<string, unknown> = {},
  always = false
): { operationId: string; end: (error?: unknown, extra?: Record<string, unknown>) => number } {
  const operationId = randomUUID()
  const startedAt = performance.now()
  const previousOperation = activeOperation
  activeOperation = operationName
  if (always) {
    appendPerformanceEvent('operation.start', {
      operationId,
      details: { operationName, ...details }
    })
  }
  let ended = false
  return {
    operationId,
    end: (error, extra = {}) => {
      const durationMs = performance.now() - startedAt
      if (ended) return durationMs
      ended = true
      activeOperation = previousOperation
      if (always || error || durationMs >= LONG_TASK_LOG_THRESHOLD_MS) {
        appendPerformanceEvent('operation.end', {
          operationId,
          level: error ? 'error' : durationMs >= LONG_TASK_LOG_THRESHOLD_MS ? 'warn' : 'info',
          details: {
            operationName,
            durationMs,
            success: !error,
            error: error instanceof Error ? error.message : error ? String(error) : null,
            ...details,
            ...extra
          }
        })
      }
      return durationMs
    }
  }
}

export function stopRendererPerformanceDiagnosticsForTests(): void {
  if (heartbeatTimer != null) window.clearTimeout(heartbeatTimer)
  heartbeatTimer = null
  initialized = false
}
