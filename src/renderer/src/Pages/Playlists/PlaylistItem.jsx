import { formatDuration } from '../../../timeUtils'
import { FaTrash } from 'react-icons/fa'
import { LuDownload, LuLink, LuPencil, LuUnlink } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useImages } from '../../Contexts/ImagesContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { memo, useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'
import ConfirmActionModal from '../../components/ConfirmActionModal/ConfirmActionModal'
import Modal from '../../components/Modal/Modal'
import PlaylistForm from '../../components/PlaylistForm/PlaylistForm'
import {
  getSourceKey,
  useVisualizerListActions,
  useVisualizerSources
} from '../../components/Render/useVisualizerPresets'

export const PlaylistItem = memo(function PlaylistItem({
  playlist,
  addPlaylisthistory,
  onSelect,
  disableNavigation = false,
  style
}) {
  if (!playlist) {
    return (
      <li className="PlaylistItem loading" id="LoadPlaylistItem" style={style}>
        <Skeleton height="60px" borderRadius="12px" />
      </li>
    )
  }

  const { deletePlaylist, getUniqueList, exportPlaylistTracks, updatePlaylistMetadata } =
    usePlaylists()
  const { getCollectionCoverUrl } = useImages()
  const { handleQueueAndPlay } = useQueue()
  const navigate = useNavigate()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [isEditVisible, setIsEditVisible] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [editPayload, setEditPayload] = useState(null)
  const { presetLists, sourceAssociations } = useVisualizerSources()
  const { associateSourceToList, removeSourceAssociation } = useVisualizerListActions()
  const playlistSource = useMemo(
    () => ({
      type: 'playlist',
      id: playlist.path
    }),
    [playlist.path]
  )
  const playlistSourceKey = useMemo(() => getSourceKey(playlistSource), [playlistSource])
  const linkedPresetListId = sourceAssociations?.[playlistSourceKey] || null
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

  const back = useMemo(
    () => {
      const coverToUse = playlist.effectiveCover || playlist.cover
      return coverToUse ? getCollectionCoverUrl(playlist.path, coverToUse) : null
    },
    [getCollectionCoverUrl, playlist.cover, playlist.effectiveCover, playlist.path]
  )

  const selectPlaylist = () => {
    if (disableNavigation) {
      onSelect?.(playlist)
      return
    }
    navigate(`/playlists/${playlist.path}`)
  }

  const handlePlayClick = async () => {
    await handleQueueAndPlay(undefined, undefined, playlist.path)
    addPlaylisthistory(playlist.path)
  }

  const menuOptions = [
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
          void removeSourceAssociation(playlistSource)
          return
        }

        void associateSourceToList(playlistSource, selectedId)
      }
    },
    { id: 'edit', label: 'Edit Playlist', icon: <LuPencil /> },
    { id: 'export', label: 'Export as M3U', icon: <LuDownload /> },
    { id: 'delete', label: 'Delete Playlist', icon: <FaTrash color="#ff4444" /> }
  ]

  const handleMenuSelect = async (optionId) => {
    if (optionId === 'edit') {
      setIsEditVisible(true)
      setIsEditLoading(true)

      try {
        const playlistData = await new Promise((resolve) => {
          getUniqueList(resolve, playlist.path)
        })

        setEditPayload(playlistData)
      } finally {
        setIsEditLoading(false)
      }

      return
    }

    if (optionId === 'delete') {
      setIsConfirmVisible(true)
      return
    }

    if (optionId === 'export') {
      const playlistData = await new Promise((resolve) => {
        getUniqueList(resolve, playlist.path)
      })

      await exportPlaylistTracks(playlistData?.processedData || [], {
        suggestedName: playlist.nombre
      })
    }
  }

  return (
    <>
      <Modal
        isVisible={isEditVisible}
        closeModal={() => {
          setIsEditVisible(false)
          setIsEditLoading(false)
          setEditPayload(null)
        }}
      >
        {isEditLoading || !editPayload?.playlistData ? (
          <div style={{ padding: '1.5rem', color: '#fff' }}>Cargando editor...</div>
        ) : (
          <PlaylistForm
            playlist={editPayload.playlistData}
            suggestedCovers={editPayload.suggestedCovers || []}
            coverConfig={editPayload.coverConfig || {}}
            automaticCover={editPayload.cover}
            effectiveCover={editPayload.effectiveCover || editPayload.cover}
            onUpdate={updatePlaylistMetadata}
            close={() => {
              setIsEditVisible(false)
              setEditPayload(null)
            }}
          />
        )}
      </Modal>

      <UndefinedItem
        cover={back}
        title={playlist.nombre}
        subtitle={`${playlist.numElementos} tracks`}
        extraInfo={formatDuration(playlist.duracion)}
        metaBadge={linkedPresetList?.name || null}
        onTitleClick={selectPlaylist}
        onPlayClick={handlePlayClick}
        detailsTo={`/playlists/${playlist.path}`}
        menuOptions={menuOptions}
        onMenuSelect={handleMenuSelect}
        className="PlaylistItem-ui"
        style={style}
      />

      <ConfirmActionModal
        isVisible={isConfirmVisible}
        title="Delete playlist?"
        message="Are you sure you want to delete this playlist?"
        confirmLabel="Delete playlist"
        onCancel={() => setIsConfirmVisible(false)}
        onConfirm={() => {
          setIsConfirmVisible(false)
          void deletePlaylist(playlist.path)
        }}
      />
    </>
  )
})
