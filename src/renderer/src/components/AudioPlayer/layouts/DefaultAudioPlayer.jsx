import './DefaultAudioPlayer.scss'

import { Controls } from '../../Controls/Controls'
import { MediaTimeDisplay } from '../../MediaTimeDisplay/MediaTimeDisplay'
import { Timer } from '../../Timer/Timer'
import { Metadata } from '../Metadata'

export function DefaultAudioPlayer({ waveformVariant }) {
  return (
    <div className="AudioPlayer AudioPlayerLayoutDefault" id="AudioPlayer">
      <Metadata />
      <Controls />
      <MediaTimeDisplay variant={waveformVariant} />
      <Timer />
    </div>
  )
}
