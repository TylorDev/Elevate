import { lazy, Suspense } from 'react'
import type { ElevateVizProps } from '../../types'
import { VizShell } from '../../layouts/VizShell/VizShell'
import styles from './ElevateViz.module.scss'

const Stage = lazy(() => import('../../pages/Stage/Stage'))
const Presets = lazy(() => import('../../pages/Presets/Presets'))

export function ElevateViz(props: ElevateVizProps) {
  return (
    <VizShell className={styles.root}>
      <Suspense fallback={null}>
        {props.view === 'presets' ? <Presets {...props} /> : <Stage {...props} />}
      </Suspense>
    </VizShell>
  )
}
