import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { Link, useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { Button } from '../Button/Button'
import { useMini } from '../../Contexts/MiniContext'
import './DirItem.scss'
import { FaPlay } from 'react-icons/fa'

export function DirItem({ directory }) {
  const navigate = useNavigate()

  const getLastPart = (path) => {
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }

  const { deleteDirectory } = useMini()

  return (
    <li key={directory.id} className="dirItem">
      <BsFolderFill className="d-icon" />
      <Link to={`/directories/${encodeURIComponent(JSON.stringify(directory))}/false`}>
        {getLastPart(directory.path)}
      </Link>
      <div className="d-datas">
        <span>{directory.totalTracks} tracks</span>
        <span>{formatDuration(directory.totalDuration)}</span>
      </div>

      <Button
        key={directory.id}
        onClick={() => {
          navigate(`/directories/${encodeURIComponent(JSON.stringify(directory))}/true`)
        }}
      >
        <FaPlay />
      </Button>
      <Button
        onClick={() => {
          deleteDirectory(directory.path)
        }}
      >
        <BsFolderMinus />
      </Button>
    </li>
  )
}
