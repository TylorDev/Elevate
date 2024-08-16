import { useEffect } from 'react'

import './Directories.scss'
import { useMini } from '../../Contexts/MiniContext'

function Directories() {
  const { getDirectories, directories, deleteDirectory } = useMini()

  useEffect(() => {
    if (directories) {
      getDirectories()
    }
  }, [])

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
