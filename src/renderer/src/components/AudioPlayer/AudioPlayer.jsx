
import './AudioPlayer.scss'

import { MediaTimeDisplay } from '../MediaTimeDisplay/MediaTimeDisplay'
import { Controls } from '../Controls/Controls'
import { Timer } from '../Timer/Timer'

import { Metadata } from './Metadata'
import { useSuper } from '../../Contexts/SupeContext'

export function AudioPlayer() {
  const { waveformVariant } = useSuper()

  return (
    <div className="AudioPlayer" id="AudioPlayer">
      <Metadata />

      <Controls />

      <MediaTimeDisplay variant={waveformVariant} />

      <Timer />
    </div>
  )
}
