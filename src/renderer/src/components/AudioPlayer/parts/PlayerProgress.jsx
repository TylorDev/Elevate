import './PlayerProgress.scss'

import { MediaTimeDisplay } from '../../MediaTimeDisplay/MediaTimeDisplay'

export function PlayerProgress({ className = '', variant }) {
  return (
    <MediaTimeDisplay
      variant={variant}
      className={['AudioPlayerPartProgress', className].filter(Boolean).join(' ')}
    />
  )
}
