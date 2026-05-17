import { useNavigate } from 'react-router-dom'
import VisualizerPresetManager from '../../components/Render/VisualizerPresetManager'
import './VisualizerPresetsPage.scss'

function VisualizerPresetsPage() {
  const navigate = useNavigate()

  return <VisualizerPresetManager isPage onClose={() => navigate('/music')} />
}

export default VisualizerPresetsPage
