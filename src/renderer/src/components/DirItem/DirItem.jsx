import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { LuFolderOpen, LuLink, LuUnlink } from 'react-icons/lu'
import { Bounce, toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useI18n } from '../../Contexts/I18nContext'
import { Skeleton } from '../Skeleton/Skeleton'
import { UndefinedItem } from '../UndefinedItem/UndefinedItem'
import { useImages } from '../../Contexts/ImagesContext'
import { memo, useMemo, useState } from 'react'
import ConfirmActionModal from '../ConfirmActionModal/ConfirmActionModal'
import {
  getSourceKey,
  useVisualizerListActions,
  useVisualizerSources
} from '../Render/useVisualizerPresets'

export const DirItem = memo(function DirItem({ directory, onSelect, disableNavigation = false, style }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { deleteDirectoryList } = usePlaylists()
  const { getCollectionCoverUrl } = useImages()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const { presetLists, sourceAssociations } = useVisualizerSources()
  const { associateSourceToList, removeSourceAssociation } = useVisualizerListActions()
  const directoryPath = directory?.path || ''
  const directorySource = useMemo(
    () => ({
      type: 'directory',
      id: directoryPath
    }),
    [directoryPath]
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
    () => (directory?.cover ? getCollectionCoverUrl(directoryPath, directory.cover) : null),
    [directory?.cover, directoryPath, getCollectionCoverUrl]
  )
  const totalTracks = Number(directory?.totalTracks) || 0
  const totalDuration = Number(directory?.totalDuration) || 0
  const recursiveTotalTracks = Number(directory?.recursiveTotalTracks) || totalTracks
  const recursiveTotalDuration = Number(directory?.recursiveTotalDuration) || totalDuration
  const isRootDirectory = directory?.directoryKind === 'root'
  const visibleTracks = isRootDirectory ? recursiveTotalTracks : totalTracks
  const visibleDuration = isRootDirectory ? recursiveTotalDuration : totalDuration

  if (!directory) {
    return (
      <div className="dirItem loading" style={style}>
        <Skeleton height="60px" borderRadius="12px" />
      </div>
    )
  }

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

  const handleOpenDirectoryInExplorer = async () => {
    const result = await window.electron.ipcRenderer.invoke(
      'open-directory-in-explorer',
      directory.path
    )

    if (!result?.success) {
      toast.error(result?.error || t('directories.openFailed'), {
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
    }
  }

  const menuOptions = [
    {
      id: 'open-directory',
      label: t('actions.openFolder'),
      icon: <LuFolderOpen />
    },
    {
      id: 'link-preset-list',
      label: 'Link',
      icon: <LuLink />,
      type: 'single-select',
      disabled: presetLists.length === 0,
      items: [
        {
          id: '__unlink__',
          label: t('actions.removeLink'),
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
    ...(!isRootDirectory
      ? [{ id: 'remove', label: 'Remove Directory', icon: <BsFolderMinus color="red" /> }]
      : [])
  ]

  const handleMenuSelect = (optionId) => {
    if (optionId === 'open-directory') {
      void handleOpenDirectoryInExplorer()
      return
    }

    if (optionId === 'remove') {
      setIsConfirmVisible(true)
    }
  }

  return (
    <>
      <UndefinedItem
        cover={cover || <BsFolderFill />}
        title={getLastPart(directory.path)}
        subtitle={isRootDirectory ? `Root - ${visibleTracks} tracks` : `${visibleTracks} tracks`}
        extraInfo={visibleDuration > 0 ? formatDuration(visibleDuration) : ''}
        metaBadge={linkedPresetList?.name || null}
        onTitleClick={selectDirectory}
        onPlayClick={handlePlayClick}
        detailsTo={`/directories/${encodeURIComponent(directory.path)}/false`}
        menuOptions={menuOptions}
        onMenuSelect={handleMenuSelect}
        className={`dirItem-ui${isRootDirectory ? ' dirItem-ui--root' : ''}`}
        style={style}
      />

      <ConfirmActionModal
        isVisible={isConfirmVisible}
        title="Remove directory?"
        message="Are you sure you want to remove this directory from the library? This only removes it from Elevate, not from your filesystem."
        confirmLabel="Remove directory"
        onCancel={() => setIsConfirmVisible(false)}
        onConfirm={() => {
          void deleteDirectoryList(directory.path)
        }}
      />
    </>
  )
})
