export const PLAYBACK_DIAGNOSTICS_SCHEMA_VERSION = 1 as const

export type PlaybackDiagnosticLevel = 'debug' | 'info' | 'warn' | 'error'

export type PlaybackDiagnosticWindowState = {
  visible: boolean | null
  minimized: boolean | null
  maximized: boolean | null
  focused: boolean | null
  backgroundThrottling: boolean | null
}

export type PlaybackDiagnosticAudioSnapshot = {
  currentTime: number | null
  duration: number | null
  paused: boolean | null
  ended: boolean | null
  readyState: number | null
  playbackRate: number | null
}

export type PlaybackDiagnosticSessionFlags = {
  shortViewAwarded: boolean
  longViewAwarded: boolean
  replayCyclePendingCompletionRepeat: boolean
  skipAwarded: boolean
  finalizing: boolean
  finalized: boolean
}

export type PlaybackDiagnosticSnapshot = {
  visibilityState?: string | null
  documentHasFocus?: boolean | null
  window?: PlaybackDiagnosticWindowState | null
  audio?: PlaybackDiagnosticAudioSnapshot | null
  activeListeningSeconds?: number | null
  flags?: PlaybackDiagnosticSessionFlags | null
}

export type PlaybackDiagnosticDetailValue =
  | string
  | number
  | boolean
  | null
  | PlaybackDiagnosticDetailValue[]
  | { [key: string]: PlaybackDiagnosticDetailValue }

type DiagnosticDetails = Record<string, PlaybackDiagnosticDetailValue>

export type PlaybackDiagnosticEventMap = {
  'run.start': DiagnosticDetails
  'session.open': DiagnosticDetails
  'session.reset': DiagnosticDetails
  'session.finalize.start': DiagnosticDetails
  'session.finalize.result': DiagnosticDetails
  'audio.play': DiagnosticDetails
  'audio.pause': DiagnosticDetails
  'audio.seeked': DiagnosticDetails
  'audio.ended': DiagnosticDetails
  'audio.replay-detected': DiagnosticDetails
  'renderer.visibility': DiagnosticDetails
  'renderer.focus': DiagnosticDetails
  'renderer.blur': DiagnosticDetails
  'award.eligible': DiagnosticDetails
  'award.request': DiagnosticDetails
  'award.suppressed': DiagnosticDetails
  'award.result': DiagnosticDetails
  'ipc.receive': DiagnosticDetails
  'db.commit': DiagnosticDetails
  'db.failure': DiagnosticDetails
  'toast.emit': DiagnosticDetails
  'window.state': DiagnosticDetails
  'system.suspend': DiagnosticDetails
  'system.resume': DiagnosticDetails
  'anomaly.duplicate-award-request': DiagnosticDetails
  'anomaly.missing-correlation': DiagnosticDetails
  'anomaly.short-view-burst': DiagnosticDetails
  'anomaly.unexpected-increment': DiagnosticDetails
  'export.start': DiagnosticDetails
  'export.complete': DiagnosticDetails
  'export.failure': DiagnosticDetails
}

export type PlaybackDiagnosticName = keyof PlaybackDiagnosticEventMap

type PlaybackDiagnosticBase<K extends PlaybackDiagnosticName> = {
  schemaVersion: typeof PLAYBACK_DIAGNOSTICS_SCHEMA_VERSION
  name: K
  occurredAt: string
  level?: PlaybackDiagnosticLevel
  sessionId?: string | null
  cycleId?: string | null
  requestId?: string | null
  cycleSequence?: number | null
  eventSequence?: number | null
  filePath?: string | null
  songId?: number | null
  snapshot?: PlaybackDiagnosticSnapshot | null
  details?: PlaybackDiagnosticEventMap[K]
}

export type PlaybackDiagnosticAppendPayload = {
  [K in PlaybackDiagnosticName]: PlaybackDiagnosticBase<K>
}[PlaybackDiagnosticName]

export type PlaybackDiagnosticEnvelope = PlaybackDiagnosticAppendPayload & {
  loggedAt: string
  appRunId: string
  source: 'renderer' | 'main'
  webContentsId?: number | null
}

export type PlaybackDiagnosticsAppendResult = { success: true } | { success: false; error: string }

export type PlaybackDiagnosticsExportResult =
  | { success: true; filePath: string }
  | { success: false; code: 'canceled' | 'export-failed'; error: string }
