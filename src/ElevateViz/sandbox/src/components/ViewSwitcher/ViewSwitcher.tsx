import type { ElevateVizView } from '@elevate-viz'
import styles from './ViewSwitcher.module.scss'

interface ViewSwitcherProps {
  value: ElevateVizView
  onChange: (view: ElevateVizView) => void
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className={styles.switcher} aria-label="Vista de ElevateViz">
      {(['stage', 'presets'] as const).map((view) => (
        <button
          className={`${styles.button} ${value === view ? styles.active : ''}`}
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
        >
          {view === 'stage' ? 'Stage' : 'Presets'}
        </button>
      ))}
    </div>
  )
}
