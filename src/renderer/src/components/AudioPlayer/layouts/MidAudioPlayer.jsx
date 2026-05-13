import './MidAudioPlayer.scss'

import { PlayerActions } from '../parts/PlayerActions'
import { PlayerMetaInline } from '../parts/PlayerMetaInline'
import { PlayerProgress } from '../parts/PlayerProgress'
import { PlayerTimeInline } from '../parts/PlayerTimeInline'

export function MidAudioPlayer({ waveformVariant }) {
  return (
    <div className="AudioPlayer AudioPlayerLayoutMid" id="AudioPlayer">
      <PlayerProgress variant={waveformVariant} className="AudioPlayerLayoutMid__progress" />
      <PlayerActions className="AudioPlayerLayoutMid__actions" />
      <PlayerTimeInline className="AudioPlayerLayoutMid__time" />
      <PlayerMetaInline />
    </div>
  )
}
