import { MediaTimeDisplay } from '../MediaTimeDisplay/MediaTimeDisplay'

export function AudioPlayerProgressRow({ progress, duration, waveformVariant, formatTime }) {
  return (
    <div className="AudioPlayer__progress-row">
      <span className="AudioPlayer__current-time">{formatTime(progress)}</span>
      <MediaTimeDisplay variant={waveformVariant} />
      <span className="AudioPlayer__duration">{formatTime(duration)}</span>
    </div>
  )
}
