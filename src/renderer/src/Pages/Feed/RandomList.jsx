import { useEffect, useState } from 'react'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './RandomList.scss'
import { useNavigate } from 'react-router-dom'
import { uint8ArrayToImageUrl } from '../../Contexts/utils'

export function RandomList() {
  const { getSavedLists, playlists } = usePlaylists()
  const { randomPlaylist } = usePlaylists()
  useEffect(() => {
    if (!playlists || playlists.length === 0) {
      getSavedLists()
    }
  }, [])
  useEffect(() => {
    const img = uint8ArrayToImageUrl(randomPlaylist?.cover)

    setCurrentBg(img)
  }, [randomPlaylist])
  const [currentbg, setCurrentBg] = useState()
  const navigate = useNavigate()
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}h:${mins.toString().padStart(2, '0')}m:${secs.toString().padStart(2, '0')}s`
  }

  return (
    <div
      className="r-list"
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
  )
}
