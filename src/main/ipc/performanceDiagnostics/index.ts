import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  NoSoundCapturePayload,
  NoSoundCaptureResult,
  NoSoundClassification,
  PerformanceDiagnosticAppendPayload,
  RendererHeartbeatPayload
} from '../../Types/performanceDiagnostics.ts'
import { exportPlaybackDiagnostics } from '../../diagnostics/playbackExport.ts'
import {
  createPerformanceDiagnostic,
  getWebContentsSnapshot,
  recordRendererHeartbeat,
  writePerformanceDiagnostic
} from '../../diagnostics/performanceDiagnostics.ts'
import {
  getPerformanceTraceStatus,
  startPerformanceTrace,
  stopPerformanceTrace
} from '../../diagnostics/performanceTrace.ts'

const SIGNAL_SILENCE_RMS = 0.0005
const SIGNAL_SILENCE_PEAK = 0.002

function finite(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function limitedString(value: unknown, limit = 4_096): string | null {
  return typeof value === 'string' ? value.slice(0, limit) : null
}

export function normalizeNoSoundCapturePayload(value: unknown): NoSoundCapturePayload | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (!input.audio || typeof input.audio !== 'object') return null
  const audio = input.audio as Record<string, unknown>
  const signal =
    audio.signal && typeof audio.signal === 'object'
      ? (audio.signal as Record<string, unknown>)
      : null
  return {
    occurredAt: limitedString(input.occurredAt, 64) || new Date().toISOString(),
    incidentId: limitedString(input.incidentId, 128) || randomUUID(),
    sessionId: limitedString(input.sessionId, 128),
    cycleId: limitedString(input.cycleId, 128),
    songId: finite(input.songId),
    filePath: limitedString(input.filePath),
    manual: input.manual === true,
    resumeRejected: input.resumeRejected === true,
    audio: {
      currentTime: finite(audio.currentTime),
      duration: finite(audio.duration),
      progressedSeconds: finite(audio.progressedSeconds),
      paused: typeof audio.paused === 'boolean' ? audio.paused : null,
      ended: typeof audio.ended === 'boolean' ? audio.ended : null,
      readyState: finite(audio.readyState),
      networkState: finite(audio.networkState),
      volume: finite(audio.volume),
      muted: typeof audio.muted === 'boolean' ? audio.muted : null,
      playbackRate: finite(audio.playbackRate),
      currentSrc: limitedString(audio.currentSrc),
      mediaErrorCode: finite(audio.mediaErrorCode),
      mediaErrorMessage: limitedString(audio.mediaErrorMessage, 2_048),
      contextState: limitedString(audio.contextState, 64),
      sampleRate: finite(audio.sampleRate),
      baseLatency: finite(audio.baseLatency),
      outputLatency: finite(audio.outputLatency),
      sourceConnected: typeof audio.sourceConnected === 'boolean' ? audio.sourceConnected : null,
      analyserConnected:
        typeof audio.analyserConnected === 'boolean' ? audio.analyserConnected : null,
      destinationConnected:
        typeof audio.destinationConnected === 'boolean' ? audio.destinationConnected : null,
      signal: signal
        ? {
            sampleCount: Math.max(0, finite(signal.sampleCount) || 0),
            rms: Math.max(0, finite(signal.rms) || 0),
            peak: Math.max(0, finite(signal.peak) || 0)
          }
        : null
    }
  }
}

export function classifyNoSoundIncident(
  payload: NoSoundCapturePayload,
  webContentsAudible: boolean
): NoSoundClassification {
  const audio = payload.audio
  if (!audio.paused && (audio.progressedSeconds ?? 0) < 0.25) return 'media-not-progressing'
  if (audio.muted || (audio.volume ?? 1) <= 0) return 'element-muted-or-zero-volume'
  if (payload.resumeRejected) return 'audio-context-resume-rejected'
  if (audio.contextState && audio.contextState !== 'running') return 'audio-context-not-running'
  if (
    audio.sourceConnected === false ||
    audio.analyserConnected === false ||
    audio.destinationConnected === false
  ) {
    return 'graph-creation-or-connection-failed'
  }
  if (
    audio.signal &&
    audio.signal.rms <= SIGNAL_SILENCE_RMS &&
    audio.signal.peak <= SIGNAL_SILENCE_PEAK
  ) {
    return 'graph-signal-zero'
  }
  if (!webContentsAudible) return 'chromium-not-audible'
  return 'external-output-suspected'
}

function captureNoSoundIncident(
  event: Electron.IpcMainInvokeEvent,
  input: unknown
): NoSoundCaptureResult {
  const payload = normalizeNoSoundCapturePayload(input)
  const incidentId = payload?.incidentId || randomUUID()
  try {
    if (!payload) {
      throw new Error('Missing audio diagnostic snapshot.')
    }
    const webContents = event.sender
    const webContentsSnapshot = getWebContentsSnapshot(webContents)
    const classification = classifyNoSoundIncident(payload, webContents.isCurrentlyAudible())
    const capturedAt = new Date().toISOString()
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('audio.no-sound-incident', {
        level: classification === 'external-output-suspected' ? 'info' : 'warn',
        incidentId,
        sessionId: payload.sessionId,
        cycleId: payload.cycleId,
        songId: payload.songId,
        filePath: payload.filePath,
        processType: 'renderer',
        pid: webContents.getOSProcessId(),
        details: {
          classification,
          manual: Boolean(payload.manual),
          capturedAt,
          audio: payload.audio,
          webContents: webContentsSnapshot
        }
      }),
      'renderer',
      webContents.id
    )
    return { success: true, incidentId, classification, capturedAt }
  } catch (error) {
    return {
      success: false,
      incidentId,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function setupPerformanceDiagnosticsHandlers(): void {
  ipcMain.on(
    'performance-diagnostics:append',
    (event, payload: PerformanceDiagnosticAppendPayload) => {
      writePerformanceDiagnostic(
        {
          ...payload,
          processType: 'renderer',
          pid: event.sender.getOSProcessId()
        } as PerformanceDiagnosticAppendPayload,
        'renderer',
        event.sender.id
      )
    }
  )
  ipcMain.on('performance-diagnostics:heartbeat', (event, payload: RendererHeartbeatPayload) => {
    recordRendererHeartbeat(event.sender.id, payload)
  })
  ipcMain.handle('performance-diagnostics:get-state', () => getPerformanceTraceStatus())
  ipcMain.handle('performance-diagnostics:trace-start', (_event, mode: 'now' | 'next-launch') =>
    startPerformanceTrace(mode === 'next-launch' ? 'next-launch' : 'now')
  )
  ipcMain.handle('performance-diagnostics:trace-stop', () => stopPerformanceTrace('manual'))
  ipcMain.handle(
    'performance-diagnostics:capture-no-sound',
    (event, payload: NoSoundCapturePayload) => captureNoSoundIncident(event, payload)
  )
  ipcMain.handle('app-diagnostics:export', (event) =>
    exportPlaybackDiagnostics(BrowserWindow.fromWebContents(event.sender))
  )
}
