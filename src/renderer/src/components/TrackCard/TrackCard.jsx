import { useEffect, useState } from 'react'
import { LuPlay, LuPause, LuHeart } from 'react-icons/lu'
import { FaPlusCircle, FaClock, FaListUl, FaEye } from 'react-icons/fa'
import { extractDominantColor } from '../../utils/useDominantColor'
import { formatDuration } from '../../../timeUtils'
import { useCoverUrl } from '../../hooks/useCoverUrl'

import { useSuper } from '../../Contexts/SupeContext'
import { useLikes } from '../../Contexts/LikeContext'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import './TrackCard.scss'

export function TrackCard({ song, index, list, isFocused }) {
  const { handleSongClick, currentFile, isPlaying, togglePlayPause } = useSuper()
  const { toggleLike, isLiked: checkLikeStatus } = useLikes()
  const coverUrl = useCoverUrl(song.filePath, 'thumb')
  const [dominantColor, setDominantColor] = useState({ hex: '#baff00', rgb: '186, 255, 0' })
  const [isLiked, setIsLiked] = useState(false)

  const isActive = currentFile?.filePath === song.filePath

  useEffect(() => {
    const initLikeStatus = async () => {
      await checkLikeStatus(song.filePath, song.title || song.fileName, setIsLiked)
    }
    initLikeStatus()
  }, [song])

  const handleLike = async (e) => {
    e.stopPropagation()
    await toggleLike(song, isLiked)
    setIsLiked(!isLiked)
  }

  const onPlay = (e) => {
    e.stopPropagation()
    if (isActive) {
      togglePlayPause()
    } else {
      handleSongClick(song, index, list, 'Mas escuchadas')
    }
  }

  useEffect(() => {
    if (coverUrl && !coverUrl.includes('svg')) {
      extractDominantColor(coverUrl).then(color => {
        setDominantColor(color)
      })
    }
  }, [coverUrl])

  const menuOptions = [
    { id: 'add-queue', label: 'Agregar a cola actual', icon: <FaPlusCircle /> },
    { id: 'add-later', label: 'Agregar a ver más tarde', icon: <FaClock /> },
    { id: 'add-playlist', label: 'Agregar a playlist', icon: <FaListUl /> },
  ]

  const handleMenuSelect = (optionId) => {
    console.log(`Selected: ${optionId} for song: ${song.title}`)
    // Aquí iría la lógica para cada acción
  }

  return (
    <div
      className={`track-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
      style={{
        '--accent-color': dominantColor.hex,
        '--accent-rgb': dominantColor.rgb
      }}
    >
      <div className="tc-cover-wrapper" onClick={onPlay}>
        <img src={coverUrl} alt={song.title} className="tc-cover" />

        <div className="tc-overlay-bottom">
          <button
            className="tc-play-btn"
            style={{ backgroundColor: dominantColor.hex }}
            onClick={onPlay}
          >
            {isActive && isPlaying ? <LuPause fill="black" /> : <LuPlay fill="black" />}
          </button>
          <span className="tc-duration">
            {formatDuration(song.duration)}
          </span>
        </div>
      </div>

      <div className="tc-info">
        <div className="tc-header">
          <h3 className="tc-title" title={song.title}>
            {song.title || song.fileName}
          </h3>
          <OverflowMenu 
            options={menuOptions} 
            onSelect={handleMenuSelect} 
            className="tc-menu"
          />
        </div>

        <p className="tc-artist">{song.artist || 'Unknown Artist'}</p>

        <div className="tc-footer">
          <div className="tc-stats">
            <FaEye />
            <span>{song.play_count || 0}</span>
          </div>
          <button 
            className={`tc-like-btn ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <LuHeart />
          </button>
        </div>
      </div>
    </div>
  )
}
