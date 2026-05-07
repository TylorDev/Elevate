import { useEffect, useState } from 'react'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import './RandomList.scss'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../../Contexts/SupeContext'
import { Skeleton } from '../../../components/Skeleton/Skeleton'

export function RandomList() {
  const { randomPlaylist, getRandomList } = usePlaylists()
  const { getImage } = useSuper()

  const [currentbg, setCurrentBg] = useState()
  const navigate = useNavigate()
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}h:${mins.toString().padStart(2, '0')}m:${secs.toString().padStart(2, '0')}s`
  }
  useEffect(() => {
    if (!randomPlaylist) {
      getRandomList()
    }
  }, [])

  const [back, setBack] = useState(null)
  useEffect(() => {
    let cover = null
    if (randomPlaylist) {
      cover = getImage(randomPlaylist.path, randomPlaylist.cover)
    }

    setBack(cover)
  }, [randomPlaylist])

  if (!randomPlaylist) {
    return (
      <div className="r-list">
        <div className="r-name">
          <span>
            {0} tracks • {'00:00:00'}
          </span>

          <span>{'Loading name...'} </span>
        </div>
        <div className="r-img">
          <Skeleton />
        </div>

        <div className="blur"></div>
      </div>
    )
  }

  return (
    <div
      className="r-list"
      onClick={() => {
        navigate(`/playlists/${randomPlaylist.path}`)
      }}
      style={{ backgroundImage: back ? `url(${back})` : 'none' }}
    >
      <div className="r-name">
        <span>
          {randomPlaylist?.numElementos} tracks • {formatDuration(randomPlaylist?.duracion)}
        </span>

        <span>{randomPlaylist?.nombre} </span>
      </div>
      <div className="r-img">
        <img src={back || undefined} alt="playlist Background" />
      </div>

      <div className="blur"></div>
    </div>
  )
}
