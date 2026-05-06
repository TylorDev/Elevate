import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Skeleton } from '@mui/material'
import { UndefinedItem } from '../UndefinedItem/UndefinedItem'
import { useSuper } from '../../Contexts/SupeContext'
import { useEffect, useState } from 'react'

export function DirItem({ directory, onSelect, disableNavigation = false }) {
  if (!directory) {
    return (
      <div className="dirItem loading">
        <BsFolderFill className="d-icon" />
        <Skeleton sx={{ bgcolor: 'grey.600' }} width="100%" height={'2rem'} />
      </div>
    )
  }

  const navigate = useNavigate()
  const { deleteDirectoryList } = usePlaylists()
  const { getImage } = useSuper()
  const [cover, setCover] = useState(null)

  useEffect(() => {
    const fetchedCover = getImage(directory.path, directory.cover)
    setCover(fetchedCover)
  }, [directory, getImage])

  const getLastPart = (path) => {
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }

  const selectDirectory = () => {
    if (disableNavigation) {
      onSelect?.(directory)
      return
    }
    navigate(`/directories/${encodeURIComponent(directory.path)}/false`)
  }

  const handlePlayClick = () => {
    if (disableNavigation) {
      onSelect?.(directory)
      return
    }
    navigate(`/directories/${encodeURIComponent(directory.path)}/true`)
  }

  const menuOptions = [
    { id: 'remove', label: 'Remove Directory', icon: <BsFolderMinus color="red" /> }
  ]

  const handleMenuSelect = (optionId) => {
    if (optionId === 'remove') {
      deleteDirectoryList(directory.path)
    }
  }

  return (
    <UndefinedItem
      cover={cover || <BsFolderFill />}
      title={getLastPart(directory.path)}
      subtitle={`${directory.totalTracks} tracks`}
      extraInfo={formatDuration(directory.totalDuration)}
      onTitleClick={selectDirectory}
      onPlayClick={handlePlayClick}
      menuOptions={menuOptions}
      onMenuSelect={handleMenuSelect}
      className="dirItem-ui"
    />
  )
}
