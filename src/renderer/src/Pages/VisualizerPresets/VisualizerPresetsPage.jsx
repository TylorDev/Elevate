import { useNavigate } from 'react-router-dom'
import VisualizerPresetManager from '../../components/Render/VisualizerPresetManager'
import './VisualizerPresetsPage.scss'

function VisualizerPresetsPage() {
  const navigate = useNavigate()

  return (
    <div className="visualizer-presets-page">
      <div className="visualizer-presets-page__manager-shell">
        <VisualizerPresetManager isPage onClose={() => navigate('/music')} />
      </div>
    </div>
  )
}

export default VisualizerPresetsPage
