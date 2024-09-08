import { useEffect, useState } from 'react'
import './Feed.scss'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { BinToBlob, uint8ArrayToImageUrl } from '../../Contexts/utils'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'

function Feed() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth)
  const { randomPlaylist } = usePlaylists()
  const { currentFile } = useSuper()
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
        <div className="r-img">
          <img src={img} alt="" />
        </div>

        <div className="blur"></div>
      </div>
      <div
        className="grid-item current-play"
        style={{ backgroundImage: `url(${BinToBlob(currentFile?.picture?.[0])})` }}
      >
        <div className="grp">
          <div className="grp-1">
            <div className="cc-artist">{currentFile.artist || 'Unknown'} - Septiembre, 2024 </div>
            <div className="cc-like">Like :</div>

            <div className="cc-titulo">
              {currentFile.title ? currentFile.title : currentFile.fileName}
            </div>
          </div>

          <div className="grp-2">Play</div>
          <div className="grp-3">
            <div className="cc-timeline">-</div>
            <div className="cc-time">0:00/4:12</div>
          </div>
        </div>
      </div>

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
