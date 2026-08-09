import { useState } from 'react'
import { LuArchive, LuCircleCheck, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import styles from './PlaybackDiagnostics.module.scss'

export type DiagnosticExportState =
  | { status: 'idle'; message: string }
  | { status: 'exporting'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export const INITIAL_DIAGNOSTIC_EXPORT_STATE: DiagnosticExportState = {
  status: 'idle',
  message: 'No diagnostic archive has been exported in this session.'
}

type PlaybackDiagnosticsViewProps = {
  exportState: DiagnosticExportState
  onExport: () => void
}

export function PlaybackDiagnosticsView({ exportState, onExport }: PlaybackDiagnosticsViewProps) {
  const isExporting = exportState.status === 'exporting'

  return (
    <section className={styles.container} aria-labelledby="playback-diagnostics-title">
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          <LuArchive />
        </span>
        <div>
          <h2 id="playback-diagnostics-title">Playback diagnostics</h2>
          <p>
            Export the evidence needed to distinguish legitimate replay cycles, duplicate IPC
            requests, database commits, and delayed notifications.
          </p>
        </div>
      </div>

      <div className={styles.notice}>
        <LuTriangleAlert aria-hidden="true" />
        <p>
          The ZIP contains full local music paths and application logs. It never includes the SQLite
          database.
        </p>
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
    </section>
  )
}

export function PlaybackDiagnostics() {
  const [exportState, setExportState] = useState<DiagnosticExportState>(
    INITIAL_DIAGNOSTIC_EXPORT_STATE
  )
  const isExporting = exportState.status === 'exporting'

  const exportDiagnostics = async () => {
    if (isExporting) return
    setExportState({ status: 'exporting', message: 'Preparing diagnostic archive…' })

    try {
      const result = await window.electron.appDiagnostics.exportPlaybackDiagnostics()
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

  return <PlaybackDiagnosticsView exportState={exportState} onExport={exportDiagnostics} />
}
