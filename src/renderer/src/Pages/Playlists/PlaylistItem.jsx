import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { BinToBlob } from '../../Contexts/utils'
import './PlaylistItem.scss'

import { Button } from './../../Components/Button/Button'
import DropdownMenu from './../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { Link, useNavigate } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

export function PlaylistItem({ playlist, addPlaylisthistory, index }) {
  const { deletePlaylist } = usePlaylists()

  const handleSelect = (option) => {
    if ('eliminar') {
      deletePlaylist(playlist.path)
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
        <img src={BinToBlob(playlist[0]?.picture?.[0] || {})} alt="" />
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
        }}
      >
        <FaPlay />
      </Button>
      <DropdownMenu options={['eliminar', 'Option 2', 'Option 3']} onSelect={handleSelect} />
    </li>
  )
}
