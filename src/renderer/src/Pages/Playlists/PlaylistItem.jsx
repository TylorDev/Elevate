import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { BinToBlob } from '../../Contexts/utils'
import './PlaylistItem.scss'

import { Button } from './../../Components/Button/Button'
import DropdownMenu from './../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { Link, useNavigate } from 'react-router-dom'
export function PlaylistItem({ playlist, addPlaylisthistory, index }) {
  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  const navigate = useNavigate()
  return (
    <li
      className="PlaylistItem"
      key={index}
      onClick={() => {
        addPlaylisthistory(playlist.path)
      }}
    >
      <div
        className="pi-item cover-pi"
        onClick={() => {
          navigate(`/playlists/${playlist.path}`)
        }}
      >
        <img src={BinToBlob(playlist[1]?.picture?.[0] || {})} alt="" />
      </div>

      <Link to={`/playlists/${playlist.path}`} className="pi-item pi-name">
        {playlist.nombre}{' '}
      </Link>
      <div className="pi-item pi-data">
        <span> {playlist.numElementos} tracks</span>
        <span> {formatDuration(playlist.duracion)} </span>
      </div>

      <div className="pi-item pi-time"> {formatTimestamp(playlist.createdAt)} </div>
      <Button className="pi-item">
        <FaPlay />
      </Button>
      <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
    </li>
  )
}
