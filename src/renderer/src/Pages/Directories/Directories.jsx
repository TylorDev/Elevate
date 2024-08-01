import { useEffect, useState } from 'react'
import { useAppContext } from '../../Contexts/AppContext'
import './Directories.scss'

import { Cola } from '../../Cola'

function Directories() {
  const { getDirectories, directories, deleteDirectory } = useAppContext()
  const [currentList, setCurrentList] = useState([])
  useEffect(() => {
    if (directories) {
      getDirectories()
    }
  }, [])

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60) // Asegúrate de usar Math.floor para obtener un número entero

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="">
      <ul>
        <h1>Directories</h1>
        {directories.map((playlist) => (
          <li key={playlist.id}>
            <button
              onClick={() => {
                deleteDirectory(playlist.path)
              }}
            >
              borrar
            </button>
            <strong>{playlist.nombre}</strong> Path: {playlist.path}
          </li>
        ))}
      </ul>
    </div>
  )
}
export default Directories
