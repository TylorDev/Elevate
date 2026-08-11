import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import {
  app,
  powerMonitor,
  webContents as electronWebContents,
  type BrowserWindow,
  type WebContents
} from 'electron'
import log from 'electron-log/main.js'
import { getStoragePaths } from '../ipc/storagePaths/paths.ts'
import {
  PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
  type PerformanceDiagnosticAppendPayload,
  type PerformanceDiagnosticDetailValue,
  type PerformanceDiagnosticEnvelope,
  type PerformanceDiagnosticLevel,
  type PerformanceDiagnosticName,
  type PerformanceMetricProcess,
  type PerformanceMetricSample,
  type RendererHeartbeatPayload
} from '../Types/performanceDiagnostics.ts'
import { appRunId } from './playbackDiagnostics.ts'

export const PERFORMANCE_LOG_MAX_SIZE = 10 * 1024 * 1024
export const PERFORMANCE_SAMPLE_INTERVAL_MS = 5_000
export const PERFORMANCE_SUMMARY_INTERVAL_MS = 30_000
export const PERFORMANCE_RING_BUFFER_MS = 2 * 60_000
export const PERFORMANCE_SLOW_OPERATION_MS = 250
export const PERFORMANCE_CPU_THRESHOLD = 80
export const PERFORMANCE_MEMORY_GROWTH_KB = 200 * 1024
export const PERFORMANCE_MEMORY_ABSOLUTE_KB = 1.5 * 1024 * 1024
export const PERFORMANCE_EVENT_LOOP_DELAY_MS = 200
export const RENDERER_VISIBLE_STALL_MS = 8_000
export const RENDERER_HIDDEN_STALL_MS = 35_000

const FIELD_LIMIT = 4_096
const ERROR_LIMIT = 2_048
const ANOMALY_COOLDOWN_MS = 60_000
const MAX_RECENT_EVENTS = 100
const MAX_SUMMARY_EVENTS = 300

const NAMES = new Set<PerformanceDiagnosticName>([
  'run.start',
  'startup.milestone',
  'operation.start',
  'operation.end',
  'metrics.summary',
  'metrics.buffer',
  'renderer.ready',
  'renderer.long-task',
  'renderer.stall-suspected',
  'renderer.unresponsive',
  'renderer.responsive',
  'renderer.render-process-gone',
  'process.child-gone',
  'anomaly.cpu-sustained',
  'anomaly.memory-growth',
  'anomaly.event-loop-delay',
  'window.lifecycle',
  'system.suspend',
  'system.resume',
  'audio.context-created',
  'audio.context-state-change',
  'audio.context-resume-attempt',
  'audio.context-resume-result',
  'audio.graph-created',
  'audio.graph-failure',
  'audio.media-event',
  'audio.signal-probe',
  'audio.no-sound-incident',
  'audio.device-change',
  'trace.state',
  'export.start',
  'export.complete',
  'export.failure'
])

type HeartbeatRecord = {
  payload: RendererHeartbeatPayload
  receivedAt: number
  staleReported: boolean
  lastSummaryAt: number
}

type OperationEndOptions = {
  error?: unknown
  details?: Record<string, unknown>
}

export type PerformanceOperation = {
  operationId: string
  end: (options?: OperationEndOptions) => number
}

const performanceLog = log.create({ logId: 'performance-diagnostics' })
const metricRing: PerformanceMetricSample[] = []
const heartbeats = new Map<number, HeartbeatRecord>()
const cpuConsecutive = new Map<number, number>()
const anomalyLastLogged = new Map<string, number>()
const recentEvents: PerformanceDiagnosticEnvelope[] = []
const startupEvents: PerformanceDiagnosticEnvelope[] = []
const noteworthyEvents: PerformanceDiagnosticEnvelope[] = []
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 })

let initialized = false
let powerEventsRegistered = false
let samplerTimer: NodeJS.Timeout | null = null
let heartbeatTimer: NodeJS.Timeout | null = null
let samplerRunning = false
let sequence = 0
let lastSummaryAt = 0
let lastWriteFailureAt = 0
let previousEventLoopUtilization = performance.eventLoopUtilization()

function limitedString(value: unknown, limit = FIELD_LIMIT): string | null {
  if (typeof value !== 'string') return null
  return value.slice(0, limit)
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeOccurredAt(value: unknown, fallback: string): string {
  const candidate = limitedString(value, 64)
  if (!candidate) return fallback
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizeValue(value: unknown, depth = 0): PerformanceDiagnosticDetailValue {
  if (depth >= 6) return '[depth-limit]'
  if (value == null || typeof value === 'boolean') return value as boolean | null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value.slice(0, FIELD_LIMIT)
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => normalizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [key.slice(0, 128), normalizeValue(item, depth + 1)])
    )
  }
  return String(value).slice(0, FIELD_LIMIT)
}

function normalizeLevel(value: unknown): PerformanceDiagnosticLevel {
  return value === 'debug' || value === 'warn' || value === 'error' ? value : 'info'
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  const { current } = getPerformanceDiagnosticsPaths()
  performanceLog.transports.file.level = 'debug'
  performanceLog.transports.file.maxSize = PERFORMANCE_LOG_MAX_SIZE
  performanceLog.transports.file.format = '{text}'
  performanceLog.transports.file.resolvePathFn = () => current
  performanceLog.transports.console.level = false
  performanceLog.initialize()
}

export function getPerformanceDiagnosticsPaths(): { current: string; old: string } {
  const current = join(getStoragePaths().logsRoot, 'performance-diagnostics.log')
  return { current, old: current.replace(/\.log$/i, '.old.log') }
}

export function normalizePerformanceDiagnosticPayload(
  value: unknown,
  source: 'main' | 'renderer',
  webContentsId?: number | null
): PerformanceDiagnosticEnvelope | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = limitedString(input.name, 128) as PerformanceDiagnosticName | null
  if (!name || !NAMES.has(name)) return null
  const loggedAt = new Date().toISOString()
  const details =
    input.details && typeof input.details === 'object'
      ? (normalizeValue(input.details) as Record<string, PerformanceDiagnosticDetailValue>)
      : undefined

  sequence += 1
  return {
    schemaVersion: PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
    name,
    occurredAt: normalizeOccurredAt(input.occurredAt, loggedAt),
    loggedAt,
    appRunId,
    source,
    sequence,
    webContentsId: finiteNumber(webContentsId),
    level: normalizeLevel(input.level),
    incidentId: limitedString(input.incidentId, 128),
    operationId: limitedString(input.operationId, 128),
    parentOperationId: limitedString(input.parentOperationId, 128),
    sessionId: limitedString(input.sessionId, 128),
    cycleId: limitedString(input.cycleId, 128),
    songId: finiteNumber(input.songId),
    filePath: limitedString(input.filePath),
    processType: limitedString(
      input.processType,
      64
    ) as PerformanceDiagnosticEnvelope['processType'],
    pid: finiteNumber(input.pid),
    details
  } as PerformanceDiagnosticEnvelope
}

export function writePerformanceDiagnostic(
  payload: PerformanceDiagnosticAppendPayload,
  source: 'main' | 'renderer' = 'main',
  webContentsId?: number | null
): boolean {
  try {
    ensureInitialized()
    const normalized = normalizePerformanceDiagnosticPayload(payload, source, webContentsId)
    if (!normalized) return false
    performanceLog[normalized.level || 'info'](JSON.stringify(normalized))
    recentEvents.push(normalized)
    if (recentEvents.length > MAX_RECENT_EVENTS) recentEvents.shift()
    const operationName = String(
      (normalized.details as Record<string, unknown> | undefined)?.operationName || ''
    )
    if (
      normalized.name === 'startup.milestone' ||
      normalized.name === 'renderer.ready' ||
      operationName.startsWith('startup.')
    ) {
      startupEvents.push(normalized)
      if (startupEvents.length > MAX_SUMMARY_EVENTS) startupEvents.shift()
    } else if (
      normalized.level === 'warn' ||
      normalized.level === 'error' ||
      normalized.name === 'audio.no-sound-incident'
    ) {
      noteworthyEvents.push(normalized)
      if (noteworthyEvents.length > MAX_SUMMARY_EVENTS) noteworthyEvents.shift()
    }
    return true
  } catch (error) {
    const now = Date.now()
    if (now - lastWriteFailureAt >= 60_000) {
      lastWriteFailureAt = now
      const message = error instanceof Error ? error.message : String(error)
      log.error('[performance diagnostics] Failed to write event:', message.slice(0, ERROR_LIMIT))
    }
    return false
  }
}

export function createPerformanceDiagnostic(
  name: PerformanceDiagnosticName,
  values: Partial<PerformanceDiagnosticAppendPayload> = {}
): PerformanceDiagnosticAppendPayload {
  return {
    schemaVersion: PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
    name,
    occurredAt: new Date().toISOString(),
    processType: 'main',
    pid: process.pid,
    ...values
  } as PerformanceDiagnosticAppendPayload
}

function processMetric(metric: Electron.ProcessMetric): PerformanceMetricProcess {
  const processType = metric.serviceName?.toLowerCase().includes('audio')
    ? 'audio-service'
    : metric.type.toLowerCase()
  return {
    pid: metric.pid,
    type: processType,
    name: metric.name || null,
    serviceName: metric.serviceName || null,
    cpuPercent: Number(metric.cpu.percentCPUUsage) || 0,
    cumulativeCpuSeconds: finiteNumber(metric.cpu.cumulativeCPUUsage),
    workingSetKb: finiteNumber(metric.memory?.workingSetSize),
    peakWorkingSetKb: finiteNumber(metric.memory?.peakWorkingSetSize),
    privateBytesKb: finiteNumber(metric.memory?.privateBytes),
    creationTime: metric.creationTime
  }
}

async function collectMetricSample(): Promise<PerformanceMetricSample> {
  const electronProcess = process as typeof process & {
    getProcessMemoryInfo?: () => Promise<Electron.ProcessMemoryInfo>
    getCPUUsage?: () => Electron.CPUUsage
    getHeapStatistics?: () => Electron.HeapStatistics
  }
  const [memory, cpu] = await Promise.all([
    electronProcess.getProcessMemoryInfo?.().catch(() => null) || Promise.resolve(null),
    Promise.resolve(
      electronProcess.getCPUUsage?.() || { percentCPUUsage: 0, idleWakeupsPerSecond: 0 }
    )
  ])
  const heap = electronProcess.getHeapStatistics?.() || { usedHeapSize: 0 }
  const elu = performance.eventLoopUtilization(previousEventLoopUtilization)
  previousEventLoopUtilization = performance.eventLoopUtilization()
  const p99 = eventLoopHistogram.percentile(99) / 1_000_000
  eventLoopHistogram.reset()

  return {
    occurredAt: new Date().toISOString(),
    main: {
      cpuPercent: Number(cpu.percentCPUUsage) || 0,
      cumulativeCpuSeconds: finiteNumber(cpu.cumulativeCPUUsage),
      workingSetKb: finiteNumber(memory?.workingSetSize),
      privateBytesKb: finiteNumber(memory?.private),
      usedHeapKb: finiteNumber(heap.usedHeapSize),
      eventLoopUtilization: Number(elu.utilization) || 0,
      eventLoopDelayP99Ms: Number.isFinite(p99) ? p99 : 0
    },
    processes: (app.getAppMetrics?.() || []).map(processMetric)
  }
}

function shouldLogAnomaly(key: string, now: number): boolean {
  const previous = anomalyLastLogged.get(key) || 0
  if (now - previous < ANOMALY_COOLDOWN_MS) return false
  anomalyLastLogged.set(key, now)
  return true
}

function flushMetricBuffer(reason: string, incidentId: string = randomUUID()): void {
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('metrics.buffer', {
      level: 'warn',
      incidentId,
      details: { reason, sampleCount: metricRing.length, samples: [...metricRing] }
    })
  )
}

function detectMetricAnomalies(sample: PerformanceMetricSample): void {
  const now = Date.now()
  for (const metric of sample.processes) {
    const count =
      metric.cpuPercent >= PERFORMANCE_CPU_THRESHOLD ? (cpuConsecutive.get(metric.pid) || 0) + 1 : 0
    cpuConsecutive.set(metric.pid, count)
    if (count >= 3 && shouldLogAnomaly(`cpu:${metric.pid}`, now)) {
      const incidentId = randomUUID()
      writePerformanceDiagnostic(
        createPerformanceDiagnostic('anomaly.cpu-sustained', {
          level: 'warn',
          incidentId,
          processType: metric.type === 'audio-service' ? 'audio-service' : 'unknown',
          pid: metric.pid,
          details: {
            thresholdPercent: PERFORMANCE_CPU_THRESHOLD,
            consecutiveSamples: count,
            metric
          }
        })
      )
      flushMetricBuffer('cpu-sustained', incidentId)
    }
  }

  const cutoff = now - 60_000
  const historic = metricRing.find((item) => new Date(item.occurredAt).getTime() >= cutoff)
  for (const metric of sample.processes) {
    const previous = historic?.processes.find((item) => item.pid === metric.pid)
    const growth = (metric.workingSetKb || 0) - (previous?.workingSetKb || metric.workingSetKb || 0)
    const absolute = metric.workingSetKb || 0
    if (
      (growth >= PERFORMANCE_MEMORY_GROWTH_KB || absolute >= PERFORMANCE_MEMORY_ABSOLUTE_KB) &&
      shouldLogAnomaly(`memory:${metric.pid}`, now)
    ) {
      const incidentId = randomUUID()
      writePerformanceDiagnostic(
        createPerformanceDiagnostic('anomaly.memory-growth', {
          level: 'warn',
          incidentId,
          pid: metric.pid,
          details: {
            growthKb: growth,
            workingSetKb: absolute,
            growthThresholdKb: PERFORMANCE_MEMORY_GROWTH_KB,
            absoluteThresholdKb: PERFORMANCE_MEMORY_ABSOLUTE_KB,
            metric
          }
        })
      )
      flushMetricBuffer('memory-growth', incidentId)
    }
  }

  if (
    sample.main.eventLoopDelayP99Ms >= PERFORMANCE_EVENT_LOOP_DELAY_MS &&
    shouldLogAnomaly('event-loop', now)
  ) {
    const incidentId = randomUUID()
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('anomaly.event-loop-delay', {
        level: 'warn',
        incidentId,
        details: {
          delayP99Ms: sample.main.eventLoopDelayP99Ms,
          thresholdMs: PERFORMANCE_EVENT_LOOP_DELAY_MS,
          utilization: sample.main.eventLoopUtilization
        }
      })
    )
    flushMetricBuffer('event-loop-delay', incidentId)
  }
}

async function sampleMetrics(): Promise<void> {
  if (samplerRunning) return
  samplerRunning = true
  try {
    const sample = await collectMetricSample()
    metricRing.push(sample)
    const cutoff = Date.now() - PERFORMANCE_RING_BUFFER_MS
    while (metricRing.length && new Date(metricRing[0].occurredAt).getTime() < cutoff) {
      metricRing.shift()
    }
    detectMetricAnomalies(sample)
    const now = Date.now()
    if (now - lastSummaryAt >= PERFORMANCE_SUMMARY_INTERVAL_MS) {
      lastSummaryAt = now
      writePerformanceDiagnostic(
        createPerformanceDiagnostic('metrics.summary', {
          details: { sample, retainedSamples: metricRing.length }
        })
      )
    }
  } catch (error) {
    log.error('[performance diagnostics] Metrics collection failed:', error)
  } finally {
    samplerRunning = false
  }
}

function checkRendererHeartbeats(): void {
  const now = Date.now()
  for (const [webContentsId, record] of heartbeats) {
    const hidden = record.payload.visibilityState !== 'visible' || !record.payload.documentHasFocus
    const thresholdMs = hidden ? RENDERER_HIDDEN_STALL_MS : RENDERER_VISIBLE_STALL_MS
    const ageMs = now - record.receivedAt
    if (ageMs < thresholdMs || record.staleReported) continue
    record.staleReported = true
    const incidentId = randomUUID()
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('renderer.stall-suspected', {
        level: 'warn',
        incidentId,
        processType: 'renderer',
        pid: getRendererPid(webContentsId),
        details: { webContentsId, heartbeatAgeMs: ageMs, thresholdMs, heartbeat: record.payload }
      })
    )
    flushMetricBuffer('renderer-heartbeat-stale', incidentId)
  }
}

function getRendererPid(webContentsId: number): number | null {
  try {
    return electronWebContents?.fromId(webContentsId)?.getOSProcessId() || null
  } catch {
    return null
  }
}

export function recordRendererHeartbeat(
  webContentsId: number,
  payload: RendererHeartbeatPayload
): boolean {
  if (!payload || payload.schemaVersion !== PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION) return false
  const occurredAt = normalizeOccurredAt(payload.occurredAt, new Date().toISOString())
  const normalized: RendererHeartbeatPayload = {
    schemaVersion: PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION,
    occurredAt,
    route: limitedString(payload.route, 512) || '',
    visibilityState: limitedString(payload.visibilityState, 64) || 'unknown',
    documentHasFocus: Boolean(payload.documentHasFocus),
    longTasks: {
      count: Math.max(0, Number(payload.longTasks?.count) || 0),
      totalDurationMs: Math.max(0, Number(payload.longTasks?.totalDurationMs) || 0),
      maxDurationMs: Math.max(0, Number(payload.longTasks?.maxDurationMs) || 0)
    },
    jsHeap: payload.jsHeap
      ? {
          usedBytes: finiteNumber(payload.jsHeap.usedBytes),
          totalBytes: finiteNumber(payload.jsHeap.totalBytes),
          limitBytes: finiteNumber(payload.jsHeap.limitBytes)
        }
      : null,
    activeOperation: limitedString(payload.activeOperation, 256)
  }
  const now = Date.now()
  const previous = heartbeats.get(webContentsId)
  const record: HeartbeatRecord = {
    payload: normalized,
    receivedAt: now,
    staleReported: false,
    lastSummaryAt: previous?.lastSummaryAt || 0
  }
  heartbeats.set(webContentsId, record)

  if (normalized.longTasks.maxDurationMs >= PERFORMANCE_SLOW_OPERATION_MS) {
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('renderer.long-task', {
        level: 'warn',
        processType: 'renderer',
        pid: getRendererPid(webContentsId),
        details: { webContentsId, route: normalized.route, ...normalized.longTasks }
      }),
      'renderer',
      webContentsId
    )
  }

  if (now - record.lastSummaryAt >= PERFORMANCE_SUMMARY_INTERVAL_MS) {
    record.lastSummaryAt = now
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('metrics.summary', {
        processType: 'renderer',
        pid: getRendererPid(webContentsId),
        details: { webContentsId, heartbeat: normalized }
      }),
      'renderer',
      webContentsId
    )
  }
  return true
}

export function forgetRendererHeartbeat(webContentsId: number): void {
  heartbeats.delete(webContentsId)
}

export function beginPerformanceOperation(
  operationName: string,
  options: {
    always?: boolean
    parentOperationId?: string | null
    details?: Record<string, unknown>
  } = {}
): PerformanceOperation {
  const operationId = randomUUID()
  const startedAt = Date.now()
  const always = options.always !== false
  if (always) {
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('operation.start', {
        operationId,
        parentOperationId: options.parentOperationId,
        details: { operationName, ...(options.details || {}) }
      })
    )
  }
  let ended = false
  return {
    operationId,
    end: ({ error, details } = {}) => {
      const durationMs = Date.now() - startedAt
      if (ended) return durationMs
      ended = true
      if (always || error || durationMs >= PERFORMANCE_SLOW_OPERATION_MS) {
        const message = error instanceof Error ? error.message : error ? String(error) : null
        writePerformanceDiagnostic(
          createPerformanceDiagnostic('operation.end', {
            level: error ? 'error' : durationMs >= PERFORMANCE_SLOW_OPERATION_MS ? 'warn' : 'info',
            operationId,
            parentOperationId: options.parentOperationId,
            details: {
              operationName,
              startedAt: new Date(startedAt).toISOString(),
              durationMs,
              success: !error,
              error: message?.slice(0, ERROR_LIMIT) || null,
              ...(options.details || {}),
              ...(details || {})
            }
          })
        )
      }
      return durationMs
    }
  }
}

export function recordStartupMilestone(
  milestone: string,
  details: Record<string, unknown> = {}
): void {
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('startup.milestone', { details: { milestone, ...details } })
  )
}

export function getPerformanceDiagnosticsSnapshot(): {
  recentMetrics: PerformanceMetricSample[]
  recentEvents: PerformanceDiagnosticEnvelope[]
  summaryEvents: PerformanceDiagnosticEnvelope[]
  heartbeats: Array<{ webContentsId: number; payload: RendererHeartbeatPayload; ageMs: number }>
} {
  const now = Date.now()
  return {
    recentMetrics: [...metricRing],
    recentEvents: [...recentEvents],
    summaryEvents: [...startupEvents, ...noteworthyEvents],
    heartbeats: [...heartbeats.entries()].map(([webContentsId, record]) => ({
      webContentsId,
      payload: record.payload,
      ageMs: now - record.receivedAt
    }))
  }
}

export function getWebContentsSnapshot(webContents: WebContents | null): Record<string, unknown> {
  if (!webContents || webContents.isDestroyed()) return { available: false }
  return {
    available: true,
    webContentsId: webContents.id,
    osProcessId: webContents.getOSProcessId(),
    audioMuted: webContents.isAudioMuted(),
    currentlyAudible: webContents.isCurrentlyAudible(),
    backgroundThrottling: webContents.getBackgroundThrottling(),
    loading: webContents.isLoading(),
    crashed: webContents.isCrashed()
  }
}

export function recordPerformanceWindowLifecycle(
  window: BrowserWindow | null,
  cause: string
): void {
  if (!window || window.isDestroyed()) return
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('window.lifecycle', {
      details: {
        cause,
        visible: window.isVisible(),
        minimized: window.isMinimized(),
        maximized: window.isMaximized(),
        focused: window.isFocused(),
        bounds: window.getBounds(),
        webContents: getWebContentsSnapshot(window.webContents)
      }
    })
  )
}

export function recordRendererHang(
  webContents: WebContents,
  state: 'unresponsive' | 'responsive',
  incidentId: string,
  durationMs?: number
): void {
  writePerformanceDiagnostic(
    createPerformanceDiagnostic(`renderer.${state}` as PerformanceDiagnosticName, {
      level: state === 'unresponsive' ? 'error' : 'info',
      incidentId,
      processType: 'renderer',
      pid: webContents.getOSProcessId(),
      details: {
        durationMs: durationMs ?? null,
        webContents: getWebContentsSnapshot(webContents),
        lastHeartbeat: heartbeats.get(webContents.id)?.payload || null
      }
    })
  )
  if (state === 'unresponsive') flushMetricBuffer('renderer-unresponsive', incidentId)
}

export function initializePerformanceDiagnostics(): void {
  ensureInitialized()
  eventLoopHistogram.enable()
  writePerformanceDiagnostic(
    createPerformanceDiagnostic('run.start', {
      details: {
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron || null,
        chromeVersion: process.versions.chrome || null,
        platform: process.platform,
        arch: process.arch,
        sampleIntervalMs: PERFORMANCE_SAMPLE_INTERVAL_MS,
        ringBufferMs: PERFORMANCE_RING_BUFFER_MS
      }
    })
  )
  if (!samplerTimer) {
    void sampleMetrics()
    samplerTimer = setInterval(() => void sampleMetrics(), PERFORMANCE_SAMPLE_INTERVAL_MS)
    samplerTimer.unref()
  }
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(checkRendererHeartbeats, 2_000)
    heartbeatTimer.unref()
  }
  if (!powerEventsRegistered) {
    powerEventsRegistered = true
    powerMonitor.on('suspend', () =>
      writePerformanceDiagnostic(createPerformanceDiagnostic('system.suspend'))
    )
    powerMonitor.on('resume', () =>
      writePerformanceDiagnostic(createPerformanceDiagnostic('system.resume'))
    )
  }
}

export function shutdownPerformanceDiagnostics(): void {
  if (samplerTimer) clearInterval(samplerTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  samplerTimer = null
  heartbeatTimer = null
  eventLoopHistogram.disable()
}

export function resetPerformanceDiagnosticsForTests(): void {
  shutdownPerformanceDiagnostics()
  metricRing.length = 0
  recentEvents.length = 0
  startupEvents.length = 0
  noteworthyEvents.length = 0
  heartbeats.clear()
  cpuConsecutive.clear()
  anomalyLastLogged.clear()
  sequence = 0
  lastSummaryAt = 0
  lastWriteFailureAt = 0
}

export function getPerformanceDiagnosticLoggerForTests() {
  return performanceLog
}
