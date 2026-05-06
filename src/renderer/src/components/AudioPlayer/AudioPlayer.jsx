
import './AudioPlayer.scss'

import { MediaTimeDisplay } from '../MediaTimeDisplay/MediaTimeDisplay'
import { Controls } from '../Controls/Controls'
import { Timer } from '../Timer/Timer'

import { Metadata } from './Metadata'

export function AudioPlayer() {
  return (
    <div className="AudioPlayer" id="AudioPlayer">
      <Metadata />

      <Controls />

      <MediaTimeDisplay variant='scilloscope' />

      <Timer />
    </div>
  )
}
