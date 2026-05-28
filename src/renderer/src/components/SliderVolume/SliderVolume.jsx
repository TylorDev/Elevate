import { useEffect, useRef, useState } from 'react'
import { LuVolume1, LuVolume2, LuVolumeX, LuChevronDown } from 'react-icons/lu'
import { usePlayback } from '../../Contexts/PlaybackContext'
import { AudioPlayerButton } from '../AudioPlayer/AudioPlayerButton'
import './SliderVolume.scss'

export function SliderVolume({ variant = 'popup' }) {
  const { volume, setMediaVolume, muted, toggleMute } = usePlayback()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  
  const displayVolume = muted ? 0 : volume
  const percentage = Math.round(displayVolume * 100)
  const isHorizontal = variant === 'horizontal'

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
    <div className={`SliderVolume ${isHorizontal ? 'horizontal' : ''}`} ref={containerRef}>
      <AudioPlayerButton
        className={`${isOpen && !isHorizontal ? 'is-active' : ''} ${muted ? 'muted' : ''}`}
        onClick={() => !isHorizontal && setIsOpen((current) => !current)}
        onContextMenu={(e) => {
          e.preventDefault()
          toggleMute()
        }}
        ariaLabel="Volume (Right click to mute)"
        title="Volume (Right click to mute)"
      >
        {getVolumeIcon()}
      </AudioPlayerButton>

      {isHorizontal ? (
        <div className="slider-container-horizontal">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={displayVolume}
            onChange={(event) => setMediaVolume(parseFloat(event.target.value))}
            className="volume-slider-horizontal"
          />
          <div 
            className="volume-progress-fill-horizontal" 
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : (
        isOpen && (
          <div className="volume-panel">
            <div className="volume-value">{percentage}%</div>
            
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={displayVolume}
                onChange={(event) => setMediaVolume(parseFloat(event.target.value))}
                className="volume-slider"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
              <div 
                className="volume-progress-fill" 
                style={{ height: `${percentage}%` }}
              />
            </div>

            <button
              className="mute-panel-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <LuVolumeX /> : <LuVolume2 />}
            </button>

            <button
              className="close-panel-btn"
              onClick={() => setIsOpen(false)}
            >
              <LuChevronDown />
            </button>
          </div>
        )
      )}
    </div>
  )
}
