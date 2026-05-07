import { LuHeart, LuHeartOff, LuPause, LuPlay } from 'react-icons/lu'
import { formatTimestamp } from '../../../../timeUtils'
import { Button } from '../../../Components/Button/Button'
import { MediaTimeDisplay } from '../../../Components/MediaTimeDisplay/MediaTimeDisplay'
import './CurrentPlaying.scss'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { useSuper } from '../../../Contexts/SupeContext'
import { useLikes } from '../../../Contexts/LikeContext'
import { Skeleton } from '../../../components/Skeleton/Skeleton'

export function CurrentPlaying() {
  const { currentCover } = usePlaylists()
  const { currentFile, togglePlayPause, isPlaying, waveformVariant } = useSuper()
  const { likeState, toggleLike } = useLikes()
  const { currentLike } = likeState

  if (!currentFile) {
    return <LoadCurrent />
  }

  return (
    <div className="current-play">
      <div className="grp">
        <div className="grp-1">
          <div className="cc-artist">
            <span>{currentFile.artist || 'Unknown'} • </span>
            <span>{formatTimestamp(Date.now())}</span>
          </div>
          <div className="cc-like">
            <button
              type="button"
              className={currentLike ? 'btnLike liked' : 'btnLike'}
              onClick={toggleLike}
            >
              {currentLike ? <LuHeart /> : <LuHeartOff />}
            </button>
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
          <MediaTimeDisplay variant={waveformVariant} />
        </div>
      </div>
      <div className="content">
        <img src={currentCover} alt="Cover" />
      </div>
    </div>
  )
}

function LoadCurrent() {
  return (
    <div className="current-play" id="LoadCurrentPlay">
      <div className="grp">
        <div className="grp-1">
          <div className="cc-artist">
            <Skeleton width="120px" height="20px" />
          </div>
          <div className="cc-like">
            <Skeleton width="30px" height="30px" borderRadius="50%" />
          </div>
          <div className="cc-titulo">
            <Skeleton width="200px" height="30px" />
          </div>
        </div>

        <div className="grp-2">
          <Skeleton width="50px" height="50px" borderRadius="50%" />
        </div>
        <div className="grp-3">
          <Skeleton width="100%" height="40px" />
        </div>
      </div>
      <div className="content">
        <Skeleton />
      </div>
    </div>
  )
}
