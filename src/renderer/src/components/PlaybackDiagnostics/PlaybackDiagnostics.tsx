import { useEffect, useMemo, useState } from 'react'
import {
  LuActivity,
  LuArchive,
  LuCircleCheck,
  LuClock3,
  LuLoaderCircle,
  LuMic,
  LuPlay,
  LuSquare,
  LuTriangleAlert
} from 'react-icons/lu'
import type { PerformanceTraceStatus } from '../../../../main/Types/performanceDiagnostics.ts'
import { usePlayback } from '../../Contexts/PlaybackContext'
import { useQueue } from '../../Contexts/QueueContext'
import { randomUUID } from '../../diagnostics/runtimeIds'
import { captureAudioPipelineSnapshot } from '../../utils/audioVisualizer'
import styles from './PlaybackDiagnostics.module.scss'

export type DiagnosticExportState =
  | { status: 'idle'; message: string }
  | { status: 'exporting'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

type ActionState = {
  status: 'idle' | 'working' | 'success' | 'error'
  message: string
}

export const INITIAL_DIAGNOSTIC_EXPORT_STATE: DiagnosticExportState = {
  status: 'idle',
  message: 'No diagnostic archive has been exported in this session.'
}

const INITIAL_TRACE_STATUS: PerformanceTraceStatus = {
  state: 'off',
  mode: null,
  startedAt: null,
  deadlineAt: null,
  capturedAt: null,
  filePath: null,
  error: null
}

type PlaybackDiagnosticsViewProps = {
  exportState: DiagnosticExportState
  traceStatus?: PerformanceTraceStatus
  traceAction?: ActionState
  noSoundAction?: ActionState
  remainingSeconds?: number | null
  canCaptureAudio?: boolean
  onExport: () => void
  onStartTrace?: () => void
  onArmNextLaunch?: () => void
  onStopTrace?: () => void
  onCaptureNoSound?: () => void
}

export function PlaybackDiagnosticsView({
  exportState,
  traceStatus = INITIAL_TRACE_STATUS,
  traceAction = { status: 'idle', message: '' },
  noSoundAction = { status: 'idle', message: '' },
  remainingSeconds = null,
  canCaptureAudio = false,
  onExport,
  onStartTrace = () => undefined,
  onArmNextLaunch = () => undefined,
  onStopTrace = () => undefined,
  onCaptureNoSound = () => undefined
}: PlaybackDiagnosticsViewProps) {
  const isExporting = exportState.status === 'exporting'
  const traceBusy = traceAction.status === 'working' || traceStatus.state === 'saving'
  const traceActive = traceStatus.state === 'recording'
  const captureBusy = noSoundAction.status === 'working'

  return (
    <section className={styles.container} aria-labelledby="application-diagnostics-title">
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <LuActivity />
        </span>
        <div>
          <h2 id="application-diagnostics-title">Application diagnostics</h2>
          <p>
            Capture startup timing, renderer stalls, process CPU and memory, playback correlation,
            and the complete Web Audio output state.
          </p>
        </div>
      </div>

      <div className={styles.notice}>
        <LuTriangleAlert aria-hidden="true" />
        <p>
          The ZIP contains full local music paths and application logs. It never includes the SQLite
          database, audio samples, cover images, or sound-device identifiers.
        </p>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <div>
            <h3>Audio output snapshot</h3>
            <p>Use this while the track is advancing but nothing can be heard.</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            onClick={onCaptureNoSound}
            disabled={!canCaptureAudio || captureBusy}
          >
            {captureBusy ? <LuLoaderCircle className={styles.spinner} /> : <LuMic />}
            {captureBusy ? 'Capturing…' : 'Capture no-sound snapshot'}
          </button>
          <p className={`${styles.status} ${styles[noSoundAction.status]}`} aria-live="polite">
            {noSoundAction.message ||
              (canCaptureAudio ? 'Ready to inspect the current track.' : 'Play a track first.')}
          </p>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <div>
            <h3>Deep performance trace</h3>
            <p>Tracing is opt-in, limited to five minutes, and keeps only the latest capture.</p>
          </div>
          <span className={styles.badge} data-state={traceStatus.state}>
            {traceStatus.state}
          </span>
        </div>
        <div className={styles.actions}>
          {traceActive ? (
            <button
              className={styles.button}
              type="button"
              onClick={onStopTrace}
              disabled={traceBusy}
            >
              <LuSquare /> Stop and save trace
            </button>
          ) : (
            <>
              <button
                className={styles.button}
                type="button"
                onClick={onStartTrace}
                disabled={traceBusy}
              >
                <LuPlay /> Start 5-minute trace now
              </button>
              <button
                className={`${styles.button} ${styles.secondary}`}
                type="button"
                onClick={onArmNextLaunch}
                disabled={traceBusy}
              >
                <LuClock3 /> Arm trace for next launch
              </button>
            </>
          )}
          <p className={`${styles.status} ${styles[traceAction.status]}`} aria-live="polite">
            {remainingSeconds != null && traceActive ? `${remainingSeconds}s remaining. ` : ''}
            {traceAction.message || traceStatus.error || traceStatus.filePath || ''}
          </p>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <div>
            <h3>Diagnostic archive</h3>
            <p>Export compact logs, summaries, and the latest deep trace when available.</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onExport} disabled={isExporting}>
            {isExporting ? (
              <LuLoaderCircle className={styles.spinner} aria-hidden="true" />
            ) : (
              <LuArchive aria-hidden="true" />
            )}
            {isExporting ? 'Exporting…' : 'Export diagnostic ZIP'}
          </button>

          <p className={`${styles.status} ${styles[exportState.status]}`} aria-live="polite">
            {exportState.status === 'success' && <LuCircleCheck aria-hidden="true" />}
            {exportState.status === 'error' && <LuTriangleAlert aria-hidden="true" />}
            {exportState.message}
          </p>
        </div>
      </div>
    </section>
  )
}

export function PlaybackDiagnostics() {
  const [exportState, setExportState] = useState<DiagnosticExportState>(
    INITIAL_DIAGNOSTIC_EXPORT_STATE
  )
  const [traceStatus, setTraceStatus] = useState<PerformanceTraceStatus>(INITIAL_TRACE_STATUS)
  const [traceAction, setTraceAction] = useState<ActionState>({ status: 'idle', message: '' })
  const [noSoundAction, setNoSoundAction] = useState<ActionState>({ status: 'idle', message: '' })
  const [clock, setClock] = useState(Date.now())
  const { mediaElement } = usePlayback()
  const { currentFile } = useQueue()
  const isExporting = exportState.status === 'exporting'

  useEffect(() => {
    let alive = true
    void window.electron.appDiagnostics.getPerformanceTraceState().then((next) => {
      if (alive) setTraceStatus(next)
    })
    const unsubscribe = window.electron.appDiagnostics.onPerformanceTraceState((next) => {
      if (alive) setTraceStatus(next)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (traceStatus.state !== 'recording') return undefined
    const timer = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [traceStatus.state])

  const remainingSeconds = useMemo(() => {
    if (!traceStatus.deadlineAt) return null
    return Math.max(0, Math.ceil((new Date(traceStatus.deadlineAt).getTime() - clock) / 1_000))
  }, [clock, traceStatus.deadlineAt])

  const exportDiagnostics = async () => {
    if (isExporting) return
    setExportState({ status: 'exporting', message: 'Preparing diagnostic archive…' })
    try {
      const result = await window.electron.appDiagnostics.exportDiagnostics()
      if (result.success) {
        setExportState({ status: 'success', message: `Saved to ${result.filePath}` })
        return
      }
      if ('code' in result && result.code === 'canceled') {
        setExportState(INITIAL_DIAGNOSTIC_EXPORT_STATE)
        return
      }
      setExportState({
        status: 'error',
        message: ('error' in result && result.error) || 'Export failed.'
      })
    } catch (error) {
      setExportState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Export failed.'
      })
    }
  }

  const startTrace = async (mode: 'now' | 'next-launch') => {
    setTraceAction({ status: 'working', message: mode === 'now' ? 'Starting trace…' : 'Arming…' })
    try {
      const result = await window.electron.appDiagnostics.startPerformanceTrace(mode)
      setTraceStatus(result.status)
      setTraceAction({
        status: result.success ? 'success' : 'error',
        message: result.success
          ? mode === 'now'
            ? 'Trace recording started.'
            : 'The next launch will be traced once.'
          : 'error' in result
            ? result.error
            : 'Unable to start trace.'
      })
    } catch (error) {
      setTraceAction({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const stopTrace = async () => {
    setTraceAction({ status: 'working', message: 'Saving trace…' })
    try {
      const next = await window.electron.appDiagnostics.stopPerformanceTrace()
      setTraceStatus(next)
      setTraceAction({
        status: next.state === 'captured' ? 'success' : 'error',
        message:
          next.state === 'captured'
            ? 'Trace saved and ready to export.'
            : next.error || 'Trace failed.'
      })
    } catch (error) {
      setTraceAction({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const captureNoSound = async () => {
    const audio = mediaElement as HTMLAudioElement | null
    if (!audio) return
    const incidentId = randomUUID()
    setNoSoundAction({ status: 'working', message: 'Sampling the audio graph for two seconds…' })
    try {
      const snapshot = await captureAudioPipelineSnapshot(audio, 'manual-no-sound')
      const result = await window.electron.appDiagnostics.captureNoSound({
        occurredAt: new Date().toISOString(),
        incidentId,
        songId: currentFile?.song_id,
        filePath: currentFile?.filePath || audio.currentSrc,
        manual: true,
        resumeRejected: snapshot.resumeRejected,
        audio: snapshot.audio
      })
      setNoSoundAction({
        status: result.success ? 'success' : 'error',
        message: result.success
          ? `Captured ${result.classification} (${result.incidentId}).`
          : 'error' in result
            ? result.error
            : 'Unable to capture audio diagnostics.'
      })
    } catch (error) {
      setNoSoundAction({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return (
    <PlaybackDiagnosticsView
      exportState={exportState}
      traceStatus={traceStatus}
      traceAction={traceAction}
      noSoundAction={noSoundAction}
      remainingSeconds={remainingSeconds}
      canCaptureAudio={Boolean(mediaElement && currentFile)}
      onExport={exportDiagnostics}
      onStartTrace={() => void startTrace('now')}
      onArmNextLaunch={() => void startTrace('next-launch')}
      onStopTrace={() => void stopTrace()}
      onCaptureNoSound={() => void captureNoSound()}
    />
  )
}
