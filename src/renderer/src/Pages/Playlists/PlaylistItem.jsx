import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { FaPlay, FaEdit, FaTrash } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import Modal from '../../Components/Modal/Modal'
import PlaylistForm from '../../Components/PlaylistForm/PlaylistForm'
import { useEffect, useState } from 'react'
import { CircularProgress } from '@mui/material'
import { UndefinedItem } from '../../Components/UndefinedItem/UndefinedItem'

export function PlaylistItem({
  playlist,
  addPlaylisthistory,
  index,
  onSelect,
  disableNavigation = false
}) {
  if (!playlist) {
    return (
      <li className="PlaylistItem loading" id="LoadPlaylistItem">
        <CircularProgress size="3.5rem" />
      </li>
    )
  }

  const { deletePlaylist, updatePlaylist } = usePlaylists()
  const { getImage, handleQueueAndPlay } = useSuper()
  const navigate = useNavigate()

  const [isVisible, setIsVisible] = useState(false)
  const [back, setBack] = useState(null)

  useEffect(() => {
    const cover = getImage(playlist.path, playlist.cover)
    setBack(cover)
  }, [playlist, getImage])

  const openModal = () => setIsVisible(true)
  const closeModal = () => setIsVisible(false)

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
    { id: 'edit', label: 'Edit Playlist', icon: <FaEdit /> },
    { id: 'delete', label: 'Delete Playlist', icon: <FaTrash color="#ff4444" /> },
  ]

  const handleMenuSelect = (optionId) => {
    if (optionId === 'delete') deletePlaylist(playlist.path)
    if (optionId === 'edit') openModal()
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
      />

      <Modal isVisible={isVisible} closeModal={closeModal}>
        <PlaylistForm playlist={playlist} onUpdate={updatePlaylist} close={closeModal} />
      </Modal>
    </>
  )
}
