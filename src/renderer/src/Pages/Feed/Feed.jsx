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
import { FaHeart } from 'react-icons/fa'

function Feed() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth)
  const { randomPlaylist } = usePlaylists()
  const { currentFile, togglePlayPause, isPlaying, currentCover } = useSuper()
  const { likeState, toggleLike } = useLikes()
  const { currentLike } = likeState
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)

    // Añade el evento de redimensionamiento
    window.addEventListener('resize', handleResize)

    // Limpia el evento cuando el componente se desmonta
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const { getSavedLists, playlists, addPlaylisthistory } = usePlaylists()
  const [currentbg, setCurrentBg] = useState()
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
          <img src={currentbg} alt="" />
        </div>

        <div className="blur"></div>
      </div>
      <div className="grid-item current-play" style={{ backgroundImage: `url(${currentCover})` }}>
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
            src="https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif"
            alt=""
          />
        </div>
      </div>
      <div className=" item7">
        <div className="hx">
          <span>Statistics </span>
          <Link to={'/search'}>Explore stats</Link>
        </div>

        <div className="bubble">
          <div className="b-t">Likes</div>
          <div className="b-n">000</div>
          <div className="b-i">
            <FaHeart />
          </div>
        </div>
        <div className="bubble">
          <div className="b-t">Tracks</div>
          <div className="b-n">000</div>
          <div className="b-i">
            <FaHeart />
          </div>
        </div>
        <div className="bubble">
          <div className="b-t">Total Listened</div>
          <div className="b-n">000</div>
          <div className="b-i">
            <FaHeart />
          </div>
        </div>
      </div>
      <div className="grid-item item8">
        Nuevas canciones, Recientes, <br /> Top Playlists
      </div>
    </div>
  )
}
export default Feed
