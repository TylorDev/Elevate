import { formatDuration } from '../../../timeUtils'
import { FaTrash } from 'react-icons/fa'
import { LuDownload } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { memo, useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'
import ConfirmActionModal from '../../components/ConfirmActionModal/ConfirmActionModal'

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

  const { deletePlaylist, getUniqueList, exportPlaylistTracks } = usePlaylists()
  const { getImage, handleQueueAndPlay } = useSuper()
  const navigate = useNavigate()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)

  const back = useMemo(
    () => (playlist.cover ? getImage(playlist.path, playlist.cover) : null),
    [getImage, playlist.cover, playlist.path]
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
    { id: 'export', label: 'Export as M3U', icon: <LuDownload /> },
    { id: 'delete', label: 'Delete Playlist', icon: <FaTrash color="#ff4444" /> }
  ]

  const handleMenuSelect = async (optionId) => {
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
