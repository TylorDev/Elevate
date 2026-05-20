import { useEffect, useRef } from 'react'
import {
  LuEllipsis,
  LuFootprints,
  LuListVideo,
  LuRepeat,
  LuRepeat1,
  LuShuffle,
  LuVolume2,
  LuVolumeX
} from 'react-icons/lu'

import { AudioPlayerButton } from './AudioPlayerButton'

export function PlayerMenu({
  isMenuOpen,
  setIsMenuOpen,
  muted,
  toggleMute,
  isStep,
  toggleStep,
  isShuffled,
  toggleShuffle,
  loop,
  toggleRepeat,
  isQueueHidden,
  onToggleQueue
}) {
  const menuRef = useRef(null)

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
  }, [isMenuOpen, setIsMenuOpen])

  const runMenuAction = (action) => {
    action()
    setIsMenuOpen(false)
  }

  return (
    <div className="AudioPlayer__menu" ref={menuRef}>
      <AudioPlayerButton
        variant="menu"
        className="AudioPlayer__menu-trigger"
        ariaLabel="Open player actions"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <LuEllipsis />
      </AudioPlayerButton>

      {isMenuOpen && (
        <div className="AudioPlayer__menu-panel" role="menu">
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
          <button
            type="button"
            role="menuitem"
            aria-pressed={!isQueueHidden}
            onClick={() => runMenuAction(onToggleQueue)}
          >
            <LuListVideo />
            <span>Queue</span>
          </button>
        </div>
      )}

      <div className="AudioPlayer__menu-inline" role="group" aria-label="Secondary player actions">
        <button
          type="button"
          className={isShuffled ? 'is-active' : ''}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <LuShuffle />
          <span>Shuffle</span>
        </button>
        <button
          type="button"
          className={isStep ? 'is-active' : ''}
          onClick={toggleStep}
          title="Step"
        >
          <LuFootprints />
          <span>Step</span>
        </button>
        <button
          type="button"
          className={loop ? 'is-active' : ''}
          onClick={toggleRepeat}
          title="Repeat"
        >
          {loop ? <LuRepeat /> : <LuRepeat1 />}
          <span>Repeat</span>
        </button>
        <button
          type="button"
          className={!isQueueHidden ? 'is-active' : ''}
          aria-pressed={!isQueueHidden}
          onClick={onToggleQueue}
          title={isQueueHidden ? 'Mostrar queue panel' : 'Ocultar queue panel'}
        >
          <LuListVideo />
          <span>Queue</span>
        </button>
      </div>
    </div>
  )
}
