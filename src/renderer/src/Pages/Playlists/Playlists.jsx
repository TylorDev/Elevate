import { useEffect, useState } from 'react'

import './Playlists.scss'
import { Cola } from '../../Components/Cola/Cola'
import { useMini } from '../../Contexts/MiniContext'

function Playlists() {
  const { getSavedLists, m3ulists } = useMini()

  const { getUniqueList, deletePlaylist, addPlaylisthistory } = useMini()
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
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp)

    // Obtener el día, mes y año
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2) // Obtener solo los dos últimos dígitos del año

    // Obtener la hora, minutos y segundos
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    // Formatear la fecha y hora como dd/mm/aa hh:mm:ss
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
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
              addPlaylisthistory(playlist.path)
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
            {playlist.numElementos} - duration:{formatDuration(playlist.duracion)} plays:
            {playlist.totalplays}
            fecha: {formatTimestamp(playlist.createdAt)}
            {}
          </li>
        ))}
      </ul>
      <Cola list={currentList} />
    </div>
  )
}
export default Playlists
