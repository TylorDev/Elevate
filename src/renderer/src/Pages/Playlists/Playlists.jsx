import { useEffect, useState } from 'react'
import { useAppContext } from '../../Contexts/AppContext'
import './Playlists.scss'
import { Cola } from '../../Components/Cola/Cola'

function Playlists() {
  const { getSavedLists, m3ulists, getUniqueList, deletePlaylist } = useAppContext()
  const [currentList, setCurrentList] = useState([])
  useEffect(() => {
    if (m3ulists) {
      getSavedLists()
    }
  }, [])

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="Playlists">
      <ul>
        <h1>Playlists</h1>
        {m3ulists.map((playlist) => (
          <li
            key={playlist.id}
            onClick={() => {
              getUniqueList(setCurrentList, playlist.path)
            }}
          >
            <button
              onClick={() => {
                deletePlaylist(playlist.path)
              }}
            >
              borrar
            </button>
            <strong>{playlist.nombre}</strong> Path: {playlist.path.substring(0, 20)}... count:{' '}
            {playlist.totalTracks} - duration:{formatDuration(playlist.totalDuration)}
          </li>
        ))}
      </ul>
      <Cola list={currentList} />
    </div>
  )
}
export default Playlists
