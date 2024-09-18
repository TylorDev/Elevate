/* eslint-disable react/prop-types */
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import './PlaylistItem.scss'

import { Button } from './../../Components/Button/Button'
import DropdownMenu from './../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { Link, useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import Modal from '../../Components/Modal/Modal'
import PlaylistForm from '../../Components/PlaylistForm/PlaylistForm'
import { useEffect, useState } from 'react'
import { dataToImageUrl } from '../../Contexts/utils'

export function PlaylistItem({ playlist, addPlaylisthistory, index }) {
  const { deletePlaylist, updatePlaylist, getAlbumByFilePath } = usePlaylists()
  const [back, setBack] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const cover = getAlbumByFilePath(playlist.path)
    setBack(cover)
    console.log(cover)
  }, [playlist, back])
  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }
  const handleSelect = (option) => {
    if (option === 'eliminar') {
      deletePlaylist(playlist.path)
    }

    if (option === 'editar') {
      openModal()
    }

    console.log(`Selected option: ${option}`)
  }

  const { handleQueueAndPlay } = useSuper()

  const navigate = useNavigate()

  return (
    <li className="PlaylistItem" key={index} onClick={() => {}}>
      <div
        className="pi-item cover-pi"
        onClick={() => {
          navigate(`/playlists/${playlist.path}`)
        }}
      >
        <img src={back?.cover} alt=" playlistcover" />
      </div>

      <Link to={`/playlists/${playlist.path}`} className="pi-item pi-name">
        {playlist.nombre}{' '}
      </Link>
      <div className="pi-item pi-data">
        <span> {playlist.numElementos} tracks</span>
        <span> {formatDuration(playlist.duracion)} </span>
      </div>

      <div className="pi-item pi-time"> {formatTimestamp(playlist.createdAt)} </div>
      <Button
        className="pi-item"
        onClick={async () => {
          await handleQueueAndPlay(undefined, undefined, playlist.path)
          addPlaylisthistory(playlist.path)
        }}
      >
        <FaPlay />
      </Button>
      <DropdownMenu options={['eliminar', 'editar', 'Option 3']} onSelect={handleSelect} />
      <Modal isVisible={isVisible} closeModal={closeModal}>
        <PlaylistForm playlist={playlist} onUpdate={updatePlaylist} close={closeModal} />
      </Modal>
    </li>
  )
}
