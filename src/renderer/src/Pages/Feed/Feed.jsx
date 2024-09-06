import { useEffect, useState } from 'react'
import './Feed.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { uint8ArrayToImageUrl } from '../../Contexts/utils'
import { useNavigate } from 'react-router-dom'

function Feed() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth)
  const { randomPlaylist } = usePlaylists()

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)

    // Añade el evento de redimensionamiento
    window.addEventListener('resize', handleResize)

    // Limpia el evento cuando el componente se desmonta
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}h:${mins.toString().padStart(2, '0')}m:${secs.toString().padStart(2, '0')}s`
  }

  const img = uint8ArrayToImageUrl(randomPlaylist?.cover)
  const navigate = useNavigate()
  return (
    <div className="grid-container">
      <div
        className="grid-item r-list"
        onClick={() => {
          navigate(`/playlists/${randomPlaylist.path}`)
        }}
        style={{ backgroundImage: `url(${img})` }}
      >
        <div className="r-name">
          <span>
            {randomPlaylist?.numElementos} tracks • {formatDuration(randomPlaylist?.duracion)}
          </span>

          <span>{randomPlaylist?.nombre} </span>
        </div>
        <img src={img} alt="" />
        <div className="blur"></div>
      </div>
      <div className="grid-item item2">Cancion randon</div>

      <div className="grid-item item4">
        Playlists, Carpetas, Favoritos.
        {screenWidth}
      </div>

      <div className="grid-item item6">Banner</div>
      <div className="grid-item item7">Estadisticas</div>
      <div className="grid-item item8">
        Nuevas canciones, Recientes, <br /> Top Playlists
      </div>
    </div>
  )
}
export default Feed
