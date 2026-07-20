import { ElevateViz } from '@elevate-viz'
import { useNavigate } from 'react-router-dom'
import styles from './VisualizerPresets.module.scss'

export default function VisualizerPresets() {
  const navigate = useNavigate()

  return (
    <div className={styles.root}>
      <ElevateViz view="presets" onNavigateStage={() => navigate('/music')} />
    </div>
  )
}
