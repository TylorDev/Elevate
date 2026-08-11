export const PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION = 1 as const

export type PerformanceDiagnosticLevel = 'debug' | 'info' | 'warn' | 'error'

export type PerformanceDiagnosticDetailValue =
  | string
  | number
  | boolean
  | null
  | PerformanceDiagnosticDetailValue[]
  | { [key: string]: PerformanceDiagnosticDetailValue }

type PerformanceDiagnosticDetails = Record<string, unknown>

export type PerformanceDiagnosticEventMap = {
  'run.start': PerformanceDiagnosticDetails
  'startup.milestone': PerformanceDiagnosticDetails
  'operation.start': PerformanceDiagnosticDetails
  'operation.end': PerformanceDiagnosticDetails
  'metrics.summary': PerformanceDiagnosticDetails
  'metrics.buffer': PerformanceDiagnosticDetails
  'renderer.ready': PerformanceDiagnosticDetails
  'renderer.long-task': PerformanceDiagnosticDetails
  'renderer.stall-suspected': PerformanceDiagnosticDetails
  'renderer.unresponsive': PerformanceDiagnosticDetails
  'renderer.responsive': PerformanceDiagnosticDetails
  'renderer.render-process-gone': PerformanceDiagnosticDetails
  'process.child-gone': PerformanceDiagnosticDetails
  'anomaly.cpu-sustained': PerformanceDiagnosticDetails
  'anomaly.memory-growth': PerformanceDiagnosticDetails
  'anomaly.event-loop-delay': PerformanceDiagnosticDetails
  'window.lifecycle': PerformanceDiagnosticDetails
  'system.suspend': PerformanceDiagnosticDetails
  'system.resume': PerformanceDiagnosticDetails
  'audio.context-created': PerformanceDiagnosticDetails
  'audio.context-state-change': PerformanceDiagnosticDetails
  'audio.context-resume-attempt': PerformanceDiagnosticDetails
  'audio.context-resume-result': PerformanceDiagnosticDetails
  'audio.graph-created': PerformanceDiagnosticDetails
  'audio.graph-failure': PerformanceDiagnosticDetails
  'audio.media-event': PerformanceDiagnosticDetails
  'audio.signal-probe': PerformanceDiagnosticDetails
  'audio.no-sound-incident': PerformanceDiagnosticDetails
  'audio.device-change': PerformanceDiagnosticDetails
  'trace.state': PerformanceDiagnosticDetails
  'export.start': PerformanceDiagnosticDetails
  'export.complete': PerformanceDiagnosticDetails
  'export.failure': PerformanceDiagnosticDetails
}

export type PerformanceDiagnosticName = keyof PerformanceDiagnosticEventMap

export type PerformanceProcessType =
  | 'main'
  | 'renderer'
  | 'gpu'
  | 'utility'
  | 'audio-service'
  | 'unknown'

export type PerformanceDiagnosticAppendPayload = {
  [K in PerformanceDiagnosticName]: {
    schemaVersion: typeof PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION
    name: K
    occurredAt: string
    level?: PerformanceDiagnosticLevel
    incidentId?: string | null
    operationId?: string | null
    parentOperationId?: string | null
    sessionId?: string | null
    cycleId?: string | null
    songId?: number | null
    filePath?: string | null
    processType?: PerformanceProcessType | null
    pid?: number | null
    details?: PerformanceDiagnosticEventMap[K]
  }
}[PerformanceDiagnosticName]

export type PerformanceDiagnosticEnvelope = PerformanceDiagnosticAppendPayload & {
  loggedAt: string
  appRunId: string
  source: 'main' | 'renderer'
  sequence: number
  webContentsId?: number | null
}

export type PerformanceMetricProcess = {
  pid: number
  type: string
  name: string | null
  serviceName: string | null
  cpuPercent: number
  cumulativeCpuSeconds: number | null
  workingSetKb: number | null
  peakWorkingSetKb: number | null
  privateBytesKb: number | null
  creationTime: number
}

export type PerformanceMetricSample = {
  occurredAt: string
  main: {
    cpuPercent: number
    cumulativeCpuSeconds: number | null
    workingSetKb: number | null
    privateBytesKb: number | null
    usedHeapKb: number | null
    eventLoopUtilization: number
    eventLoopDelayP99Ms: number
  }
  processes: PerformanceMetricProcess[]
}

export type RendererHeartbeatPayload = {
  schemaVersion: typeof PERFORMANCE_DIAGNOSTICS_SCHEMA_VERSION
  occurredAt: string
  route: string
  visibilityState: string
  documentHasFocus: boolean
  longTasks: {
    count: number
    totalDurationMs: number
    maxDurationMs: number
  }
  jsHeap?: {
    usedBytes: number | null
    totalBytes: number | null
    limitBytes: number | null
  } | null
  activeOperation?: string | null
}

export type AudioPipelineSnapshot = {
  currentTime: number | null
  duration: number | null
  progressedSeconds: number | null
  paused: boolean | null
  ended: boolean | null
  readyState: number | null
  networkState: number | null
  volume: number | null
  muted: boolean | null
  playbackRate: number | null
  currentSrc: string | null
  mediaErrorCode: number | null
  mediaErrorMessage: string | null
  contextState: string | null
  sampleRate: number | null
  baseLatency: number | null
  outputLatency: number | null
  sourceConnected: boolean | null
  analyserConnected: boolean | null
  destinationConnected: boolean | null
  signal: {
    sampleCount: number
    rms: number
    peak: number
  } | null
}

export type NoSoundClassification =
  | 'media-not-progressing'
  | 'element-muted-or-zero-volume'
  | 'audio-context-not-running'
  | 'audio-context-resume-rejected'
  | 'graph-creation-or-connection-failed'
  | 'graph-signal-zero'
  | 'chromium-not-audible'
  | 'external-output-suspected'

export type NoSoundCapturePayload = {
  occurredAt: string
  incidentId: string
  sessionId?: string | null
  cycleId?: string | null
  songId?: number | null
  filePath?: string | null
  manual: boolean
  resumeRejected?: boolean
  audio: AudioPipelineSnapshot
}

export type NoSoundCaptureResult =
  | {
      success: true
      incidentId: string
      classification: NoSoundClassification
      capturedAt: string
    }
  | { success: false; incidentId: string; error: string }

export type PerformanceTraceState = 'off' | 'armed' | 'recording' | 'saving' | 'captured' | 'failed'

export type PerformanceTraceStatus = {
  state: PerformanceTraceState
  mode: 'now' | 'next-launch' | null
  startedAt: string | null
  deadlineAt: string | null
  capturedAt: string | null
  filePath: string | null
  error: string | null
}

export type PerformanceTraceStartResult =
  | { success: true; status: PerformanceTraceStatus }
  | { success: false; status: PerformanceTraceStatus; error: string }

export type PerformanceDiagnosticsExportResult =
  | { success: true; filePath: string }
  | { success: false; code: 'canceled' | 'export-failed'; error: string }
