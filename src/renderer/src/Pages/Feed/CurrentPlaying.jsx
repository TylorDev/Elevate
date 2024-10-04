import { LuHeart, LuHeartOff, LuPause, LuPlay } from 'react-icons/lu'
import { formatTimestamp } from '../../../timeUtils'
import { Button } from '../../Components/Button/Button'
import { MediaTimeDisplay } from '../../Components/MediaTimeDisplay/MediaTimeDisplay'
import './CurrentPlaying.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useSuper } from '../../Contexts/SupeContext'

import { useLikes } from '../../Contexts/LikeContext'

export function CurrentPlaying() {
  const { currentCover } = usePlaylists()
  const { currentFile, togglePlayPause, isPlaying } = useSuper()
  const { likeState, toggleLike } = useLikes()
  const { currentLike } = likeState
  return (
    <div className="current-play">
      <div className="grp  ">
        <div className="grp-1">
          <div className="cc-artist">
            <span>{currentFile.artist || 'Unknown'} • </span>
            <span>{formatTimestamp(Date.now())}</span>
          </div>
          <div className="cc-like">
            <Button
              className={currentLike ? 'btnLike liked' : 'btnLike'}
              onClick={() => {
                toggleLike()
              }}
            >
              {' '}
              {currentLike ? <LuHeart /> : <LuHeartOff />}
            </Button>
          </div>

          <div className="cc-titulo">
            {currentFile.title ? currentFile.title : currentFile.fileName}
          </div>
        </div>

        <div className="grp-2" onClick={togglePlayPause}>
          <Button className="btnPlay" onClick={togglePlayPause}>
            {isPlaying ? <LuPause /> : <LuPlay />}
          </Button>
        </div>
        <div className="grp-3">
          <MediaTimeDisplay />
        </div>
      </div>
      <div className="content">
        <img src={currentCover} alt="NO IMG" />
      </div>
    </div>
  )
}
