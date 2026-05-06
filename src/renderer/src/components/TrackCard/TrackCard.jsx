import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuPlay, LuPause, LuHeart } from 'react-icons/lu'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { FaPlusCircle, FaClock, FaListUl, FaEye } from 'react-icons/fa'
import { extractDominantColor } from '../../utils/useDominantColor'
import { formatDuration } from '../../../timeUtils'
import { useCoverUrl } from '../../hooks/useCoverUrl'

import { useSuper } from '../../Contexts/SupeContext'
import { useLikes } from '../../Contexts/LikeContext'
import './TrackCard.scss'

export function TrackCard({ song, index, list, isFocused }) {
  const { handleSongClick, currentFile, isPlaying, togglePlayPause } = useSuper()
  const { toggleLike, isLiked: checkLikeStatus } = useLikes()
  const coverUrl = useCoverUrl(song.filePath, 'thumb')
  const [dominantColor, setDominantColor] = useState({ hex: '#baff00', rgb: '186, 255, 0' })
  const [showMenu, setShowMenu] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const btnRef = useRef(null)

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
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', () => setShowMenu(false), true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', () => setShowMenu(false), true)
    }
  }, [showMenu])

  useEffect(() => {
    if (coverUrl && !coverUrl.includes('svg')) {
      extractDominantColor(coverUrl).then(color => {
        setDominantColor(color)
      })
    }
  }, [coverUrl])

  const toggleMenu = (e) => {
    e.stopPropagation()
    if (!showMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceRight = window.innerWidth - rect.left
      
      let top = rect.bottom + 5
      let left = rect.left - 150 // Align to right of button roughly

      // Ajustar si se sale por abajo
      if (spaceBelow < 200) {
        top = rect.top - 160
      }
      
      // Ajustar si se sale por la derecha/izquierda
      if (left < 10) left = 10
      if (left + 180 > window.innerWidth) left = window.innerWidth - 190

      setMenuPos({ top, left })
    }
    setShowMenu(!showMenu)
  }

  const dropdownMenu = showMenu ? createPortal(
    <div 
      className="tc-dropdown" 
      ref={menuRef}
      style={{ 
        position: 'fixed',
        top: `${menuPos.top}px`,
        left: `${menuPos.left}px`,
        zIndex: 9999
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tc-dropdown-item">
        <FaPlusCircle /> Agregar a cola actual
      </div>
      <div className="tc-dropdown-item">
        <FaClock /> Agregar a ver más tarde
      </div>
      <div className="tc-dropdown-item">
        <FaListUl /> Agregar a playlist
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div
      className={`track-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''} ${showMenu ? 'menu-open' : ''}`}
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
          <div className="tc-menu-container">
            <button className="tc-menu-btn" onClick={toggleMenu} ref={btnRef}>
              <HiOutlineDotsVertical />
            </button>
          </div>
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
      {dropdownMenu}
    </div>
  )
}
