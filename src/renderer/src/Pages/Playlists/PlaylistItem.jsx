import { formatDuration } from '../../../timeUtils'
import { FaTrash } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { memo, useMemo } from 'react'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'

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

  const { deletePlaylist } = usePlaylists()
  const { getImage, handleQueueAndPlay } = useSuper()
  const navigate = useNavigate()

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
    { id: 'delete', label: 'Delete Playlist', icon: <FaTrash color="#ff4444" /> }
  ]

  const handleMenuSelect = (optionId) => {
    if (optionId === 'delete') deletePlaylist(playlist.path)
  }

  return (
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
  )
})
