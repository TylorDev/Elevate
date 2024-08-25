import { useEffect, useState } from 'react'
import './Feed.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

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

  return (
    <div className="grid-container">
      <div className="grid-item item1">
        {randomPlaylist?.nombre} <br />
        {randomPlaylist?.numElementos} tracks <br />
        {formatDuration(randomPlaylist?.duracion)}
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
