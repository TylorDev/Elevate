import { useEffect, useRef, useState } from 'react'
import { DirItem } from '../../DirItem/DirItem'
import { useMini } from '../../../Contexts/MiniContext'
import Cola from '../../Cola/Cola'
import './DirectoriesQueueTab.scss'

function getLastPart(path = '') {
  const parts = path.split('\\')
  return parts[parts.length - 1]
}

function DirectoriesQueueTab({ isActive }) {
  const { directories, directoriesLoaded, directoriesLoading, getDirFiles, getDirectories } =
    useMini()
  const [selectedDirectory, setSelectedDirectory] = useState(null)
  const [currentDir, setCurrentDir] = useState([])
  const getDirFilesRef = useRef(getDirFiles)
  const selectedDirectoryPath = selectedDirectory?.path

  useEffect(() => {
    if (isActive && !directoriesLoaded && !directoriesLoading) {
      getDirectories()
    }
  }, [directoriesLoaded, directoriesLoading, getDirectories, isActive])

  useEffect(() => {
    getDirFilesRef.current = getDirFiles
  }, [getDirFiles])

  useEffect(() => {
    if (!selectedDirectoryPath) return

    setCurrentDir([])
    getDirFilesRef.current(setCurrentDir, selectedDirectoryPath)
  }, [selectedDirectoryPath])

  if (selectedDirectory) {
    return (
      <div className="DirectoriesQueueTab">
        <div className="DirectoriesQueueTab__bar">
          <button type="button" onClick={() => setSelectedDirectory(null)}>
            List
          </button>
          <span>{getLastPart(selectedDirectory.path)}</span>
        </div>
        <Cola list={currentDir} name={`folder:${selectedDirectory.path}`} />
      </div>
    )
  }

  return (
    <div className="DirectoriesQueueTab">
      <ul className="DirectoriesQueueTab__list">
        {directories.length > 0 ? (
          directories.map((directory) => (
            <DirItem
              key={directory.id}
              directory={directory}
              disableNavigation
              onSelect={setSelectedDirectory}
            />
          ))
        ) : (
          <>
            <DirItem />
            <DirItem />
            <DirItem />
          </>
        )}
      </ul>
    </div>
  )
}

export default DirectoriesQueueTab
