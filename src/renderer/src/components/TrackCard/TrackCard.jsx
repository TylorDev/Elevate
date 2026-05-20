import { memo, useEffect, useState, useMemo, useCallback } from 'react'
import { LuPlay, LuPause, LuHeart } from 'react-icons/lu'
import { FaPlusCircle, FaClock, FaListUl, FaEye } from 'react-icons/fa'
import { extractDominantColor } from '../../utils/useDominantColor'
import { formatDuration } from '../../../timeUtils'
import { useCoverUrl } from '../../hooks/useCoverUrl'

import { usePlayback } from '../../Contexts/PlaybackContext'
import { useQueue } from '../../Contexts/QueueContext'
import { useLikes } from '../../Contexts/LikeContext'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import './TrackCard.scss'

export const TrackCard = memo(function TrackCard({ song, index, list, isFocused }) {
  const { handleSongClick, currentFile, appendToCurrentQueue } = useQueue()
  const { isPlaying, togglePlayPause } = usePlayback()
  const { toggleLike, isLiked: checkLikeStatus } = useLikes()
  const coverUrl = useCoverUrl(song.filePath, 'thumb')
  const [dominantColor, setDominantColor] = useState({ hex: '#baff00', rgb: '186, 255, 0' })
  const [isLiked, setIsLiked] = useState(false)

  const isActive = currentFile?.filePath === song.filePath
  const shortViews = song.short_view_count || 0

  useEffect(() => {
    const initLikeStatus = async () => {
      await checkLikeStatus(song.filePath, song.title || song.fileName, setIsLiked)
    }
    initLikeStatus()
  }, [song?.filePath])

  const handleLike = useCallback(
    async (e) => {
      e.stopPropagation()
      await toggleLike(song, isLiked)
      setIsLiked(!isLiked)
    },
    [song, isLiked, toggleLike]
  )

  const onPlay = useCallback(
    (e) => {
      e.stopPropagation()
      if (isActive) {
        togglePlayPause()
      } else {
        handleSongClick(song, index, list, 'Mas escuchadas')
      }
    },
    [isActive, togglePlayPause, handleSongClick, song, index, list]
  )

  useEffect(() => {
    if (coverUrl && !coverUrl.includes('svg')) {
      const id = requestIdleCallback(() => {
        extractDominantColor(coverUrl).then((color) => {
          setDominantColor(color)
        })
      })
      return () => cancelIdleCallback(id)
    }
  }, [coverUrl])

  const menuOptions = useMemo(
    () => [
      { id: 'add-queue', label: 'Agregar a cola actual', icon: <FaPlusCircle /> },
      { id: 'add-later', label: 'Agregar a ver más tarde', icon: <FaClock /> },
      { id: 'add-playlist', label: 'Agregar a playlist', icon: <FaListUl /> }
    ],
    []
  )

  const handleMenuSelect = useCallback(
    (optionId) => {
      if (optionId === 'add-queue') {
        appendToCurrentQueue(song)
        return
      }

      console.log(`Selected: ${optionId} for song: ${song.title}`)
      // Aquí iría la lógica para cada acción
    },
    [appendToCurrentQueue, song]
  )

  return (
    <div className={`track-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}>
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
          <span className="tc-duration">{formatDuration(song.duration)}</span>
        </div>
      </div>

      <div className="tc-info">
        <div className="tc-header">
          <h3 className="tc-title" title={song.title}>
            {song.title || song.fileName}
          </h3>
          <OverflowMenu options={menuOptions} onSelect={handleMenuSelect} className="tc-menu" />
        </div>

        <p className="tc-artist">{song.artist || 'Unknown Artist'}</p>

        <div className="tc-footer">
          <div className="tc-stats">
            <FaEye />
            <span>{shortViews}</span>
          </div>
          <button className={`tc-like-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
            <LuHeart />
          </button>
        </div>
      </div>
    </div>
  )
})
