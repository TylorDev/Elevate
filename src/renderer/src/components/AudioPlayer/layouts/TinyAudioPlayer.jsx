import './TinyAudioPlayer.scss'

import { PlayerActions } from '../parts/PlayerActions'
import { PlayerMetaStack } from '../parts/PlayerMetaStack'
import { PlayerProgress } from '../parts/PlayerProgress'
import { PlayerTimeInline } from '../parts/PlayerTimeInline'

export function TinyAudioPlayer({ waveformVariant }) {
  return (
    <div className="AudioPlayer AudioPlayerLayoutTiny" id="AudioPlayer">
      <div className="AudioPlayerLayoutTiny__timeline">
        <PlayerTimeInline className="AudioPlayerLayoutTiny__time" mode="split" />
        <PlayerProgress variant={waveformVariant} className="AudioPlayerLayoutTiny__progress" />
      </div>
      <PlayerMetaStack />
      <PlayerActions className="AudioPlayerLayoutTiny__actions" />
    </div>
  )
}
