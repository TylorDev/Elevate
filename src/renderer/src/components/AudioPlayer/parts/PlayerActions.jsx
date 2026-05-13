import './PlayerActions.scss'

import { PlayerOverflowMenuTrigger, TransportControls } from '../../Controls/Controls'
import { VolumeControl } from '../../Timer/Timer'
import { MetadataLikeButton } from '../Metadata'

export function PlayerActions({ className = '' }) {
  return (
    <div className={['AudioPlayerPartActions', className].filter(Boolean).join(' ')}>
      <TransportControls className="AudioPlayerPartActions__controls" />
      <VolumeControl className="AudioPlayerPartActions__volume" />
      <MetadataLikeButton className="AudioPlayerPartActions__like" />
      <PlayerOverflowMenuTrigger className="AudioPlayerPartActions__menu" />
    </div>
  )
}
