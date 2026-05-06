import React, { useEffect, useState, useRef } from 'react'
import { LuPlay, LuPause, LuHeart } from 'react-icons/lu'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { FaPlusCircle, FaClock, FaListUl, FaEye } from 'react-icons/fa'
import { extractDominantColor } from '../../utils/useDominantColor'
import { formatDuration } from '../../../timeUtils'
import { useCoverUrl } from '../../hooks/useCoverUrl'

import { useSuper } from '../../Contexts/SupeContext'
import './TrackCard.scss'

export function TrackCard({ song, index, list, isFocused }) {
  const { handleSongClick, currentFile, isPlaying, togglePlayPause } = useSuper()
  const coverUrl = useCoverUrl(song.filePath, 'thumb')
  const [dominantColor, setDominantColor] = useState({ hex: '#baff00', rgb: '186, 255, 0' })
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  
  const isActive = currentFile?.filePath === song.filePath

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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
    setShowMenu(!showMenu)
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
          <div className="tc-menu-container" ref={menuRef}>
            <button className="tc-menu-btn" onClick={toggleMenu}>
              <HiOutlineDotsVertical />
            </button>
            {showMenu && (
              <div className="tc-dropdown">
                <div className="tc-dropdown-item">
                  <FaPlusCircle /> Agregar a cola actual
                </div>
                <div className="tc-dropdown-item">
                  <FaClock /> Agregar a ver más tarde
                </div>
                <div className="tc-dropdown-item">
                  <FaListUl /> Agregar a playlist
                </div>
              </div>
            )}
          </div>
        </div>
        
        <p className="tc-artist">{song.artist || 'Unknown Artist'}</p>

        <div className="tc-footer">
          <div className="tc-stats">
            <FaEye />
            <span>{song.play_count || 0}</span>
          </div>
          <button className="tc-like-btn">
            <LuHeart />
          </button>
        </div>
      </div>
    </div>
  )
}
