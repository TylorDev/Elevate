import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { LuLink, LuUnlink } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Skeleton } from '../Skeleton/Skeleton'
import { UndefinedItem } from '../UndefinedItem/UndefinedItem'
import { useSuper } from '../../Contexts/SupeContext'
import { memo, useMemo, useState } from 'react'
import ConfirmActionModal from '../ConfirmActionModal/ConfirmActionModal'
import {
  getSourceKey,
  useVisualizerListActions,
  useVisualizerSources
} from '../Render/useVisualizerPresets'

export const DirItem = memo(function DirItem({ directory, onSelect, disableNavigation = false, style }) {
  if (!directory) {
    return (
      <div className="dirItem loading" style={style}>
        <Skeleton height="60px" borderRadius="12px" />
      </div>
    )
  }

  const navigate = useNavigate()
  const { deleteDirectoryList } = usePlaylists()
  const { getImage } = useSuper()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const { presetLists, sourceAssociations } = useVisualizerSources()
  const { associateSourceToList, removeSourceAssociation } = useVisualizerListActions()
  const directorySource = useMemo(
    () => ({
      type: 'directory',
      id: directory.path
    }),
    [directory.path]
  )
  const directorySourceKey = useMemo(() => getSourceKey(directorySource), [directorySource])
  const linkedPresetListId = sourceAssociations?.[directorySourceKey] || null
  const linkedPresetList = useMemo(
    () => presetLists.find((list) => list.id === linkedPresetListId) || null,
    [linkedPresetListId, presetLists]
  )
  const orderedPresetLists = useMemo(() => {
    return [...presetLists].sort((firstList, secondList) => {
      if (firstList.id === linkedPresetListId) {
        return -1
      }

      if (secondList.id === linkedPresetListId) {
        return 1
      }

      return firstList.name.localeCompare(secondList.name)
    })
  }, [linkedPresetListId, presetLists])
  const cover = useMemo(
    () => (directory.cover ? getImage(directory.path, directory.cover) : null),
    [directory.cover, directory.path, getImage]
  )
  const totalTracks = Number(directory.totalTracks) || 0
  const totalDuration = Number(directory.totalDuration) || 0
  const isRootDirectory = totalTracks === 0 && totalDuration === 0

  const getLastPart = (path) => {
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }

  const selectDirectory = () => {
    if (disableNavigation) {
      onSelect?.(directory)
      return
    }
    navigate(`/directories/${encodeURIComponent(directory.path)}/false`)
  }

  const handlePlayClick = () => {
    if (disableNavigation) {
      onSelect?.(directory)
      return
    }
    navigate(`/directories/${encodeURIComponent(directory.path)}/true`)
  }

  const menuOptions = [
    ...(!isRootDirectory
      ? [
          {
            id: 'link-preset-list',
            label: 'Vincular',
            icon: <LuLink />,
            type: 'single-select',
            disabled: presetLists.length === 0,
            items: [
              {
                id: '__unlink__',
                label: 'Quitar vinculo',
                icon: <LuUnlink />,
                checked: !linkedPresetListId
              },
              ...orderedPresetLists.map((list) => ({
                id: list.id,
                label: list.name,
                checked: list.id === linkedPresetListId
              }))
            ],
            onItemSelect: (selectedId) => {
              if (selectedId === '__unlink__') {
                void removeSourceAssociation(directorySource)
                return
              }

              void associateSourceToList(directorySource, selectedId)
            }
          },
          { id: 'remove', label: 'Remove Directory', icon: <BsFolderMinus color="red" /> }
        ]
      : [])
  ]

  const handleMenuSelect = (optionId) => {
    if (optionId === 'remove') {
      setIsConfirmVisible(true)
    }
  }

  return (
    <>
      <UndefinedItem
        cover={cover || <BsFolderFill />}
        title={getLastPart(directory.path)}
        subtitle={isRootDirectory ? 'Raiz' : `${totalTracks} tracks`}
        extraInfo={isRootDirectory ? '' : formatDuration(totalDuration)}
        metaBadge={linkedPresetList?.name || null}
        onTitleClick={selectDirectory}
        onPlayClick={handlePlayClick}
        detailsTo={`/directories/${encodeURIComponent(directory.path)}/false`}
        menuOptions={menuOptions}
        onMenuSelect={handleMenuSelect}
        className="dirItem-ui"
        style={style}
      />

      <ConfirmActionModal
        isVisible={isConfirmVisible}
        title="Remove directory?"
        message="Are you sure you want to remove this directory from the library? This only removes it from Elevate, not from your filesystem."
        confirmLabel="Remove directory"
        onCancel={() => setIsConfirmVisible(false)}
        onConfirm={() => {
          setIsConfirmVisible(false)
          void deleteDirectoryList(directory.path)
        }}
      />
    </>
  )
})
