import { BsFolderFill, BsFolderMinus } from 'react-icons/bs'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../../timeUtils'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Skeleton } from '../Skeleton/Skeleton'
import { UndefinedItem } from '../UndefinedItem/UndefinedItem'
import { useSuper } from '../../Contexts/SupeContext'
import { memo, useMemo, useState } from 'react'
import ConfirmActionModal from '../ConfirmActionModal/ConfirmActionModal'

export const DirItem = memo(function DirItem({ directory, onSelect, disableNavigation = false, style }) {
  if (!directory) {
    return (
      <div className="dirItem loading" style={style}>
        <Skeleton height="60px" borderRadius="12px" />
      </div>
    )
  }

  const navigate = useNavigate()
  const { deleteDirectoryList } = usePlaylists()
  const { getImage } = useSuper()
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const cover = useMemo(
    () => (directory.cover ? getImage(directory.path, directory.cover) : null),
    [directory.cover, directory.path, getImage]
  )

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
      setIsConfirmVisible(true)
    }
  }

  return (
    <>
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
        style={style}
      />

      <ConfirmActionModal
        isVisible={isConfirmVisible}
        title="Remove directory?"
        message="Are you sure you want to remove this directory from the library? This only removes it from Elevate, not from your filesystem."
        confirmLabel="Remove directory"
        onCancel={() => setIsConfirmVisible(false)}
        onConfirm={() => {
          setIsConfirmVisible(false)
          void deleteDirectoryList(directory.path)
        }}
      />
    </>
  )
})
