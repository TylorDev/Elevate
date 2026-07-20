import { LuCircleAlert, LuCircleCheck, LuDatabase, LuDisc3, LuImage } from 'react-icons/lu'
import type { BrowserPersistenceMode } from '../../services/browserVisualizerPersistence'
import styles from './DiagnosticsBar.module.scss'

interface DiagnosticsBarProps {
  fileName?: string
  durationSeconds: number
  audioState: string
  hasEmbeddedCover: boolean
  persistenceMode: BrowserPersistenceMode
  warning?: string | null
}

const durationLabel = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function DiagnosticsBar({
  fileName,
  durationSeconds,
  audioState,
  hasEmbeddedCover,
  persistenceMode,
  warning
}: DiagnosticsBarProps) {
  return (
    <aside className={styles.bar} aria-label="Diagnóstico del sandbox">
      <span><LuDisc3 /> {fileName || 'Sin archivo'}</span>
      <span><LuCircleCheck /> Audio: {audioState} · {durationLabel(durationSeconds)}</span>
      <span><LuImage /> Cover: {hasEmbeddedCover ? 'ID3' : 'placeholder'}</span>
      <span><LuDatabase /> {persistenceMode === 'localStorage' ? 'Favoritos locales' : 'Solo memoria'}</span>
      {warning && <span className={styles.warning} title={warning}><LuCircleAlert /> {warning}</span>}
    </aside>
  )
}
