 
import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { Link, useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { Button } from '../Button/Button'
import { useMini } from '../../Contexts/MiniContext'
import './DirItem.scss'
import { FaPlay } from 'react-icons/fa'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Skeleton } from '@mui/material'

export function DirItem({ directory, onSelect, disableNavigation = false }) {
  if (!directory) {
    return (
      <div className="dirItem" id="loaddirItem">
        <BsFolderFill className="d-icon" />
        <Skeleton sx={{ bgcolor: 'grey.600' }} width="100%" height={'2rem'} />
      </div>
    )
  }
  const navigate = useNavigate()

  const getLastPart = (path) => {
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }
  const { deleteDirectoryList } = usePlaylists()

  const selectDirectory = () => {
    if (disableNavigation) {
      onSelect?.(directory)
      return
    }

    navigate(`/directories/${encodeURIComponent(directory.path)}/false`)
  }

  return (
    <li key={directory.id} className="dirItem">
      <BsFolderFill className="d-icon" />
      {disableNavigation ? (
        <button type="button" onClick={selectDirectory}>
          {getLastPart(directory.path)}
        </button>
      ) : (
        <Link to={`/directories/${encodeURIComponent(directory.path)}/false`}>{getLastPart(directory.path)}</Link>
      )}
      <div className="d-datas">
        <span>{directory.totalTracks} tracks</span>
        <span>{formatDuration(directory.totalDuration)}</span>
      </div>

      <Button
        key={directory.id}
        onClick={() => {
          if (disableNavigation) {
            onSelect?.(directory)
            return
          }

          navigate(`/directories/${encodeURIComponent(directory.path)}/true`)
        }}
      >
        <FaPlay />
      </Button>
      <Button
        onClick={() => {
          deleteDirectoryList(directory.path)
        }}
      >
        <BsFolderMinus color="red" />
      </Button>
    </li>
  )
}
