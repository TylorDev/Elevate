import { useCallback, useEffect, useState } from 'react'
import { RiArrowLeftLine } from 'react-icons/ri'
import { DirItem } from '../../DirItem/DirItem'
import { useMini } from '../../../Contexts/MiniContext'
import Cola from '../../Cola/Cola'
import VirtualizedQueueEntityList from '../VirtualizedQueueEntityList'
import './DirectoriesQueueTab.scss'

const DIRECTORY_ROW_HEIGHT = 76
const DIRECTORY_OVERSCAN = 6

function getLastPart(path = '') {
  const parts = path.split('\\')
  return parts[parts.length - 1]
}

function DirectoriesQueueTab({ isActive }) {
  const { directories, directoriesLoaded, directoriesLoading, getDirFiles, getDirectories } =
    useMini()
  const [selectedDirectory, setSelectedDirectory] = useState(null)
  const [currentDir, setCurrentDir] = useState([])
  const selectedDirectoryPath = selectedDirectory?.path

  useEffect(() => {
    if (isActive && !directoriesLoaded && !directoriesLoading) {
      getDirectories()
    }
  }, [directoriesLoaded, directoriesLoading, getDirectories, isActive])

  useEffect(() => {
    if (!selectedDirectoryPath) return

    setCurrentDir([])
    getDirFiles(setCurrentDir, selectedDirectoryPath)
  }, [getDirFiles, selectedDirectoryPath])

  const renderDirectoryRow = useCallback(
    (directory, index, style) => <DirItem key={directory?.id || index} directory={directory} disableNavigation onSelect={setSelectedDirectory} style={style} />,
    []
  )

  if (selectedDirectory) {
    return (
      <div className="DirectoriesQueueTab">
        <div className="DirectoriesQueueTab__bar">
          <button 
            type="button" 
            className="back-btn"
            onClick={() => setSelectedDirectory(null)}
            title="Back to list"
          >
            <RiArrowLeftLine />
          </button>
          <span className="current-path">{getLastPart(selectedDirectory.path)}</span>
        </div>
        <Cola
          list={currentDir}
          name={`folder:${selectedDirectory.path}`}
          preserveOrder
          enablePinMove
          pinMoveScope="source-local"
          sourceKey={`folder:${selectedDirectory.path}`}
        />
      </div>
    )
  }

  return (
    <div className="DirectoriesQueueTab">
      <VirtualizedQueueEntityList
        className="DirectoriesQueueTab__list"
        items={directories}
        itemSize={DIRECTORY_ROW_HEIGHT}
        overscanCount={DIRECTORY_OVERSCAN}
        itemKey={(index, directory) => directory?.id || directory?.path || `directory-${index}`}
        renderItem={renderDirectoryRow}
        loading={!directoriesLoaded && directoriesLoading}
      />
    </div>
  )
}

export default DirectoriesQueueTab
