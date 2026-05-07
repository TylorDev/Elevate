import { useEffect, useRef, useState } from 'react'
import {
  LuEllipsis,
  LuListVideo,
  LuPause,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuShuffle,
  LuVolume2,
  LuVolumeX,
  LuFootprints,
  LuRepeat,
  LuRepeat1
} from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'

import './Controls.scss'
import { Button } from '../Button/Button'
import { useSuper } from '../../Contexts/SupeContext'

export function Controls() {
  const {
    handleNextClick,
    handlePreviousClick,
    togglePlayPause,
    isPlaying,
    muted,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    isShuffled,
    loop,
    toggleStep,
    isStep
  } = useSuper()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const runMenuAction = (action) => {
    action()
    setIsMenuOpen(false)
  }

  return (
    <div className="controls" id="controls">
      <div className="controls-menu" ref={menuRef}>
        <Button
          className="btnMenu"
          aria-label="Open player actions"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <LuEllipsis />
        </Button>

        {isMenuOpen && (
          <div className="controls-overflow" role="menu">
            <button type="button" role="menuitem" onClick={() => runMenuAction(toggleMute)}>
              {muted ? <LuVolumeX /> : <LuVolume2 />}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(toggleStep)}>
              {isStep ? <LuFootprints className="Step" /> : <LuFootprints />}
              <span>Step</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(toggleShuffle)}>
              <LuShuffle id={isShuffled ? 'btnShuffle-true' : 'btnShuffle-false'} />
              <span>Shuffle</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(toggleRepeat)}>
              {loop ? <LuRepeat id="btnShuffle-true" /> : <LuRepeat1 id="btnShuffle-false" />}
              <span>Repeat</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(() => navigate('/music'))}>
              <LuListVideo />
              <span>Queue</span>
            </button>
          </div>
        )}
      </div>

      <Button onClick={handlePreviousClick} className="btnBack" aria-label="Previous song">
        <LuSkipBack />
      </Button>
      <Button className="btnPlay" onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <LuPause /> : <LuPlay />}
      </Button>
      <Button className="btnNext" onClick={handleNextClick} aria-label="Next song">
        <LuSkipForward />
      </Button>
    </div>
  )
}
