import { formatDuration } from '../../../timeUtils'
import { FaTrash } from 'react-icons/fa'
import { LuDownload, LuLink, LuListMusic, LuPencil, LuUnlink } from 'react-icons/lu'
import { Bounce, toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { useImages } from '../../Contexts/ImagesContext'
import { useI18n } from '../../Contexts/I18nContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { memo, useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'
import ConfirmActionModal from '../../components/ConfirmActionModal/ConfirmActionModal'
import Modal from '../../components/Modal/Modal'
import PlaylistForm from '../../components/PlaylistForm/PlaylistForm'
import PlaylistSaveModal from '../../components/PlaylistSaveModal/PlaylistSaveModal'
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
  showDuration = true,
  useGenericCoverFallback = false,
  style
}) {
  const {
    deletePlaylist,
    getUniqueList,
    updatePlaylistMetadata,
    exportPlaylistTracksToDirectory
  } = usePlaylists()
  const { getCollectionCoverUrl, useCollectionCover } = useImages()
  const { handleQueueAndPlay } = useQueue()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [isEditVisible, setIsEditVisible] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [editPayload, setEditPayload] = useState(null)
  const [isExportVisible, setIsExportVisible] = useState(false)
  const [exportTracks, setExportTracks] = useState([])
  const [isExportLoading, setIsExportLoading] = useState(false)
  const { presetLists, sourceAssociations } = useVisualizerSources()
  const { associateSourceToList, removeSourceAssociation } = useVisualizerListActions()
  const playlistPath = playlist?.path || ''
  const playlistSource = useMemo(
    () => ({
      type: 'playlist',
      id: playlistPath
    }),
    [playlistPath]
  )
  const playlistSourceKey = useMemo(() => getSourceKey(playlistSource), [playlistSource])
  const autoCoverKey = useMemo(
    () => (playlistPath ? `playlist:auto:${playlistPath}` : ''),
    [playlistPath]
  )
  const autoCoverSignature = playlist?.coverConfig?.customCoverHash || playlist?.customCoverHash || ''
  const cachedAutoCoverUrl = useCollectionCover(autoCoverKey, autoCoverSignature)
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
      const coverToUse = playlist?.effectiveCover || playlist?.cover
      if (coverToUse) return getCollectionCoverUrl(playlistPath, coverToUse)
      if (cachedAutoCoverUrl && !cachedAutoCoverUrl.includes('svg')) return cachedAutoCoverUrl
      if (useGenericCoverFallback) return <LuListMusic />
      return null
    },
    [
      cachedAutoCoverUrl,
      getCollectionCoverUrl,
      playlist?.cover,
      playlist?.effectiveCover,
      playlistPath,
      useGenericCoverFallback
    ]
  )

  if (!playlist) {
    return (
      <li className="PlaylistItem loading" id="LoadPlaylistItem" style={style}>
        <Skeleton height="60px" borderRadius="12px" />
      </li>
    )
  }

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
          void removeSourceAssociation(playlistSource)
          return
        }

        void associateSourceToList(playlistSource, selectedId)
      }
    },
    { id: 'edit', label: t('actions.editPlaylist'), icon: <LuPencil /> },
    { id: 'export', label: t('actions.exportAsM3u'), icon: <LuDownload />, disabled: isExportLoading },
    { id: 'delete', label: t('actions.deletePlaylist'), icon: <FaTrash color="#ff4444" /> }
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
      setIsExportLoading(true)
      try {
        const playlistData = await new Promise((resolve) => {
          getUniqueList(resolve, playlist.path)
        })
        const tracks = playlistData?.processedData || []

        if (tracks.length === 0) {
          toast.error(t('playlists.exportEmpty'), {
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

        setExportTracks(tracks)
        setIsExportVisible(true)
      } catch (error) {
        console.error('Error loading playlist for export:', error)
        toast.error(error?.message || t('playlists.saveFailed'), {
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
        setIsExportLoading(false)
      }
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
          <div style={{ padding: '1.5rem', color: '#fff' }}>{t('playlists.loadingEditor')}</div>
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

      <PlaylistSaveModal
        isVisible={isExportVisible}
        onClose={() => {
          setIsExportVisible(false)
          setExportTracks([])
          setIsExportLoading(false)
        }}
        tracks={exportTracks}
        sourceName={playlist.path}
        onSubmitSave={({ tracks, targetDirectory, nombre, replacePath }) =>
          exportPlaylistTracksToDirectory(tracks, {
            targetDirectory,
            nombre,
            replacePath
          })
        }
        submitLabel="Export"
        titleOverride="Exportar playlist como M3U"
        modeLabel="Export M3U"
      />

      <UndefinedItem
        cover={back}
        title={playlist.nombre}
        subtitle={`${playlist.numElementos} tracks`}
        extraInfo={showDuration ? formatDuration(playlist.duracion) : ''}
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
          void deletePlaylist(playlist.path)
        }}
      />
    </>
  )
})
