import { useCallback, useEffect, useMemo, useState } from 'react'
import { BsFolderFill } from 'react-icons/bs'
import { RiArrowLeftLine, RiShuffleLine } from 'react-icons/ri'
import { Bounce, toast } from 'react-toastify'
import { DirItem } from '../../DirItem/DirItem'
import { useMini } from '../../../Contexts/MiniContext'
import { useQueue } from '../../../Contexts/QueueContext'
import { dedupedInvoke } from '../../../Contexts/utils'
import Cola from '../../Cola/Cola'
import VirtualizedQueueEntityList from '../VirtualizedQueueEntityList'
import { UndefinedItem } from '../../UndefinedItem/UndefinedItem'
import './DirectoriesQueueTab.scss'

const DIRECTORY_ROW_HEIGHT = 76
const DIRECTORY_OVERSCAN = 6

function getPathParts(path = '') {
  return String(path)
    .split('\\')
    .map((part) => part.trim())
    .filter(Boolean)
}

function getLastPart(path = '') {
  const parts = getPathParts(path)
  return parts[parts.length - 1] || path
}

function getParentDirectoryInfo(path = '') {
  const parts = getPathParts(path)

  if (parts.length < 2) {
    return {
      groupId: path || '__root__',
      groupName: getLastPart(path) || 'Directories'
    }
  }

  const parentParts = parts.slice(0, -1)

  return {
    groupId: parentParts.join('\\'),
    groupName: parentParts[parentParts.length - 1] || getLastPart(path)
  }
}

function DirectoriesQueueTab({ isActive }) {
  const { directories, directoriesLoaded, directoriesLoading, getDirFiles, getDirectories } = useMini()
  const { playQueueShuffled } = useQueue()
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedDirectory, setSelectedDirectory] = useState(null)
  const [currentDir, setCurrentDir] = useState([])
  const [directoryCount, setDirectoryCount] = useState(null)
  const [playingRandom, setPlayingRandom] = useState(false)
  const selectedDirectoryPath = selectedDirectory?.path
  const groupedDirectories = useMemo(() => {
    const groupsMap = new Map()

    directories.forEach((directory) => {
      if (!directory?.path) {
        return
      }

      const { groupId, groupName } = getParentDirectoryInfo(directory.path)
      const currentGroup = groupsMap.get(groupId)

      if (currentGroup) {
        currentGroup.directories.push(directory)
        return
      }

      groupsMap.set(groupId, {
        id: groupId,
        path: groupId,
        name: groupName,
        directories: [directory]
      })
    })

    return [...groupsMap.values()]
      .map((group) => ({
        ...group,
        totalDirectories: group.directories.length
      }))
      .sort((firstGroup, secondGroup) => {
        const nameDifference = firstGroup.name.localeCompare(secondGroup.name)

        if (nameDifference !== 0) {
          return nameDifference
        }

        return firstGroup.path.localeCompare(secondGroup.path)
      })
  }, [directories])
  const selectedGroupDirectories = useMemo(
    () =>
      [...(selectedGroup?.directories || [])].sort((firstDirectory, secondDirectory) =>
        getLastPart(firstDirectory.path).localeCompare(getLastPart(secondDirectory.path))
      ),
    [selectedGroup]
  )

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

  useEffect(() => {
    if (!isActive) return

    let cancelled = false

    dedupedInvoke('get-directories-number')
      .then((count) => {
        if (!cancelled) {
          setDirectoryCount(Number(count) || 0)
        }
      })
      .catch((error) => {
        console.error('Error loading directories count:', error)
      })

    return () => {
      cancelled = true
    }
  }, [directories.length, directoriesLoaded, isActive])

  const renderDirectoryRow = useCallback(
    (directory, index, style) => <DirItem key={directory?.id || index} directory={directory} disableNavigation onSelect={setSelectedDirectory} style={style} />,
    []
  )

  const showRandomButton = !selectedGroup && !selectedDirectory && Number(directoryCount) > 0

  const handlePlayRandomDirectory = useCallback(async () => {
    if (playingRandom) {
      return
    }

    setPlayingRandom(true)

    try {
      const randomDirectory = await dedupedInvoke('get-random-directory')

      if (!randomDirectory?.path) {
        toast.error('No hay directorios disponibles para reproducir.', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })
        return
      }

      const tracks = await dedupedInvoke('get-audio-in-directory', randomDirectory.path)

      if (!Array.isArray(tracks) || tracks.length === 0) {
        toast.error('El directorio aleatorio no tiene canciones disponibles.', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })
        return
      }

      playQueueShuffled(tracks, `folder:${randomDirectory.path}`)
    } catch (error) {
      console.error('Error playing random directory:', error)
      toast.error(error?.message || 'No se pudo reproducir un directorio aleatorio.', {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })
    } finally {
      setPlayingRandom(false)
    }
  }, [playQueueShuffled, playingRandom])
  const renderGroupRow = useCallback(
    (group, index, style) => (
      <UndefinedItem
        key={group?.id || index}
        cover={<BsFolderFill />}
        title={group?.name || 'Directory Group'}
        subtitle={`${group?.totalDirectories || 0} directorios`}
        extraInfo={group?.path || ''}
        onTitleClick={() => setSelectedGroup(group)}
        onPlayClick={() => setSelectedGroup(group)}
        className="DirectoriesQueueTab__group-item"
        style={style}
      />
    ),
    []
  )

  const handleBack = useCallback(() => {
    if (selectedDirectory) {
      setSelectedDirectory(null)
      return
    }

    if (selectedGroup) {
      setSelectedGroup(null)
    }
  }, [selectedDirectory, selectedGroup])

  if (selectedDirectory) {
    return (
      <div className="DirectoriesQueueTab">
        <div className="DirectoriesQueueTab__bar">
          <button 
            type="button" 
            className="back-btn"
            onClick={handleBack}
            title="Back to list"
          >
            <RiArrowLeftLine />
          </button>
          <span className="current-path">{getLastPart(selectedDirectory.path)}</span>
        </div>
        <Cola
          height="100%"
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

  if (selectedGroup) {
    return (
      <div className="DirectoriesQueueTab">
        <div className="DirectoriesQueueTab__bar">
          <button
            type="button"
            className="back-btn"
            onClick={handleBack}
            title="Back to groups"
          >
            <RiArrowLeftLine />
          </button>
          <span className="current-path">{selectedGroup.name}</span>
        </div>
        <VirtualizedQueueEntityList
          className="DirectoriesQueueTab__list"
          items={selectedGroupDirectories}
          itemSize={DIRECTORY_ROW_HEIGHT}
          overscanCount={DIRECTORY_OVERSCAN}
          itemKey={(index, directory) => directory?.id || directory?.path || `directory-${index}`}
          renderItem={renderDirectoryRow}
        />
      </div>
    )
  }

  return (
    <div className="DirectoriesQueueTab">
      <VirtualizedQueueEntityList
        className="DirectoriesQueueTab__list"
        items={groupedDirectories}
        itemSize={DIRECTORY_ROW_HEIGHT}
        overscanCount={DIRECTORY_OVERSCAN}
        itemKey={(index, group) => group?.id || `directory-group-${index}`}
        renderItem={renderGroupRow}
        loading={!directoriesLoaded && directoriesLoading}
      />
      {showRandomButton ? (
        <button
          type="button"
          className="DirectoriesQueueTab__random-fab"
          onClick={() => void handlePlayRandomDirectory()}
          title="Random directory"
          aria-label="Play random directory"
          disabled={playingRandom}
        >
          <RiShuffleLine />
        </button>
      ) : null}
    </div>
  )
}

export default DirectoriesQueueTab
