import { useEffect, useRef, useState } from 'react'
import { LuChevronDown, LuVolume1, LuVolume2, LuVolumeX } from 'react-icons/lu'

import { useSuper } from '../../Contexts/SupeContext'
import './SliderVolume.scss'

export function SliderVolume() {
  const { volume, setMediaVolume, muted } = useSuper()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const displayVolume = muted ? 0 : volume

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getVolumeIcon = () => {
    if (muted || volume === 0) return <LuVolumeX />
    if (volume < 0.5) return <LuVolume1 />
    return <LuVolume2 />
  }

  return (
    <div className="SliderVolume" ref={containerRef}>
      <button
        className="volume-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Volume"
        aria-expanded={isOpen}
      >
        {getVolumeIcon()}
      </button>

      {isOpen && (
        <div className="volume-panel">
          <button
            className="close-button"
            onClick={() => setIsOpen(false)}
            aria-label="Hide volume slider"
          >
            <LuChevronDown />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={displayVolume}
            onChange={(event) => setMediaVolume(event.target.value)}
            className="volume-slider"
            aria-label="Volume level"
          />
        </div>
      )}
    </div>
  )
}
