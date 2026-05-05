import './Timer.scss'
import { useSuper } from '../../Contexts/SupeContext'
import { SliderVolume } from '../SliderVolume/SliderVolume'

export function Timer() {
  const { progress, duration } = useSuper()

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="Timer">
      <div className="Timer__time" aria-label="Song time">
        <span className="current-time">{formatTime(progress)}</span>
        <span className="separator">/</span>
        <span className="duration">{formatTime(duration)}</span>
      </div>
      <SliderVolume />
    </div>
  )
}
