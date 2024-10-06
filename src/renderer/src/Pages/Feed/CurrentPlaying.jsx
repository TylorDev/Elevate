import { LuHeart, LuHeartOff, LuPause, LuPlay } from 'react-icons/lu'
import { formatTimestamp } from '../../../timeUtils'
import { Button } from '../../Components/Button/Button'
import { MediaTimeDisplay } from '../../Components/MediaTimeDisplay/MediaTimeDisplay'
import './CurrentPlaying.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useSuper } from '../../Contexts/SupeContext'

import { useLikes } from '../../Contexts/LikeContext'
import { Skeleton, Typography } from '@mui/material'

export function CurrentPlaying() {
  const { currentCover } = usePlaylists()
  const { currentFile, togglePlayPause, isPlaying } = useSuper()
  const { likeState, toggleLike } = useLikes()
  const { currentLike } = likeState

  if (!currentFile) {
    return <LoadCurrent />
  }

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
function LoadCurrent() {
  return (
    <div className="current-play" id="LoadCurrentPlay">
      <div className="grp  ">
        <div className="grp-1">
          <div className="cc-artist">
            <Typography component="div" variant={'h5'}>
              <Skeleton sx={{ bgcolor: 'grey.900' }} />
            </Typography>
            <span>
              <Typography component="div" variant={'h4'} width={'10rem'}>
                <Skeleton sx={{ bgcolor: 'grey.900' }} />
              </Typography>
            </span>
          </div>
          <div className="cc-like">
            <Button className={true ? 'btnLike liked' : 'btnLike'}>
              {' '}
              {true ? <LuHeart /> : <LuHeartOff />}
            </Button>
          </div>

          <div className="cc-titulo">
            <Typography component="div" variant={'h4'}>
              <Skeleton sx={{ bgcolor: 'grey.900' }} />
            </Typography>
          </div>
        </div>

        <div className="grp-2">
          <Button className="btnPlay">{true ? <LuPause /> : <LuPlay />}</Button>
        </div>
        <div className="grp-3">
          <MediaTimeDisplay />
        </div>
      </div>
      <div className="content">
        <Skeleton sx={{ bgcolor: 'grey.900' }} />
      </div>
    </div>
  )
}
