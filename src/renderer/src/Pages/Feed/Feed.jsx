import { useEffect, useState } from 'react'
import './Feed.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { uint8ArrayToImageUrl } from '../../Contexts/utils'
import { Link, useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { Button } from '../../Components/Button/Button'
import { LuHeart, LuHeartOff, LuPause, LuPlay } from 'react-icons/lu'
import { useLikes } from '../../Contexts/LikeContext'
import { formatTimestamp } from '../../../timeUtils'
import { MediaTimeDisplay } from '../../Components/MediaTimeDisplay/MediaTimeDisplay'

import { PlaylistItem } from '../Playlists/PlaylistItem'
import { Cola } from './../../Components/Cola/Cola'
import { useMini } from '../../Contexts/MiniContext'
import { MiniStats } from './MiniStats'
import { SuperLink } from './SuperLink'

function Feed() {
  const { randomPlaylist } = usePlaylists()
  const { currentFile, togglePlayPause, isPlaying } = useSuper()
  const { likeState, toggleLike } = useLikes()
  const { currentLike } = likeState

  const { getSavedLists, playlists, addPlaylisthistory, news } = usePlaylists()
  const [currentbg, setCurrentBg] = useState()
  const { recents } = useMini()
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}h:${mins.toString().padStart(2, '0')}m:${secs.toString().padStart(2, '0')}s`
  }
  useEffect(() => {
    if (!playlists || playlists.length === 0) {
      getSavedLists()
    }
  }, [])
  useEffect(() => {
    const img = uint8ArrayToImageUrl(randomPlaylist?.cover)

    setCurrentBg(img)
  }, [randomPlaylist])

  const navigate = useNavigate()
  return (
    <div className="grid-container">
      <div
        className="grid-item r-list"
        onClick={() => {
          navigate(`/playlists/${randomPlaylist.path}`)
        }}
        style={{ backgroundImage: `url(${currentbg})` }}
      >
        <div className="r-name">
          <span>
            {randomPlaylist?.numElementos} tracks • {formatDuration(randomPlaylist?.duracion)}
          </span>

          <span>{randomPlaylist?.nombre} </span>
        </div>
        <div className="r-img">
          <img src={currentbg} alt="playlist Background" />
        </div>

        <div className="blur"></div>
      </div>
      <div className="grid-item current-play" style={{ backgroundImage: `url("")` }}>
        <div className="grp">
          <div className="grp-1">
            <div className="cc-artist">
              <span>{currentFile.artist || 'Unknown'} • </span>
              <span>{formatTimestamp(Date.now())}</span>
            </div>
            <div className="cc-like">
              <Button className={currentLike ? 'btnLike liked' : 'btnLike'} onClick={toggleLike}>
                {' '}
                {currentLike ? <LuHeart /> : <LuHeartOff />}
              </Button>
            </div>

            <div className="cc-titulo">
              {currentFile.title ? currentFile.title : currentFile.fileName}
            </div>
          </div>

          <div className="grp-2">
            <Button className="btnPlay" onClick={togglePlayPause}>
              {isPlaying ? <LuPause /> : <LuPlay />}
            </Button>
          </div>
          <div className="grp-3">
            <MediaTimeDisplay />
          </div>
        </div>
      </div>

      <div className="grid-item tabs">
        <ul>
          {playlists.map((playlist, index) => (
            <PlaylistItem
              playlist={playlist}
              addPlaylisthistory={addPlaylisthistory}
              key={index}
              index={index}
            />
          ))}
        </ul>
      </div>

      <div className="grid-item item6">
        <div>
          <img
            // src="https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif"
            alt="no foto"
          />
        </div>
      </div>
      <MiniStats />

      <div className="grid-item aside">
        <div className="aside-sec">
          <SuperLink name={'recents'} url={'/search'} desc={'Show more'} />
          <Cola list={news.slice(0, 5)} />
        </div>
        <div className="aside-sec">
          <SuperLink name={'LISTEN MORE OFTEN'} url={'/search'} desc={'Show more'} />
          <Cola list={recents.slice(0, 5)} />
        </div>
      </div>
    </div>
  )
}
export default Feed
