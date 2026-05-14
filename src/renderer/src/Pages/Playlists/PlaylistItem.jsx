import { formatDuration } from '../../../timeUtils'
import { FaTrash } from 'react-icons/fa'
import { LuDownload, LuPencil } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { memo, useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'
import ConfirmActionModal from '../../components/ConfirmActionModal/ConfirmActionModal'
import Modal from '../../components/Modal/Modal'
import PlaylistForm from '../../components/PlaylistForm/PlaylistForm'

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
  const { getImage, handleQueueAndPlay } = useSuper()
  const navigate = useNavigate()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [isEditVisible, setIsEditVisible] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [editPayload, setEditPayload] = useState(null)

  const back = useMemo(
    () => {
      const coverToUse = playlist.effectiveCover || playlist.cover
      return coverToUse ? getImage(playlist.path, coverToUse) : null
    },
    [getImage, playlist.cover, playlist.effectiveCover, playlist.path]
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
        onTitleClick={selectPlaylist}
        onPlayClick={handlePlayClick}
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
