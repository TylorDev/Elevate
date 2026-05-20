import { useCallback, useEffect, useMemo, useState } from 'react'
import { BsFolderFill } from 'react-icons/bs'
import { RiArrowLeftLine } from 'react-icons/ri'
import { DirItem } from '../../DirItem/DirItem'
import { useMini } from '../../../Contexts/MiniContext'
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
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedDirectory, setSelectedDirectory] = useState(null)
  const [currentDir, setCurrentDir] = useState([])
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

  const renderDirectoryRow = useCallback(
    (directory, index, style) => <DirItem key={directory?.id || index} directory={directory} disableNavigation onSelect={setSelectedDirectory} style={style} />,
    []
  )
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
    </div>
  )
}

export default DirectoriesQueueTab
