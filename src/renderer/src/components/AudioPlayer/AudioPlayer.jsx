import './AudioPlayer.scss'

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LuHeart,
  LuHeartOff,
  LuPause,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuEllipsis,
  LuFootprints,
  LuListVideo,
  LuRepeat,
  LuRepeat1,
  LuShuffle,
  LuVolume2,
  LuVolumeX
} from 'react-icons/lu'

import { SliderVolume } from '../SliderVolume/SliderVolume'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaybackProgress } from '../../Contexts/PlaybackProgressContext'
import { usePlayback } from '../../Contexts/PlaybackContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'

import { AudioPlayerButton } from './AudioPlayerButton'

import { AudioPlayerMetadata } from './AudioPlayerMetadata'
import { AudioPlayerProgressRow } from './AudioPlayerProgressRow'
import { useIsCompactHeaderViewport, useIsCompactViewportHeight } from '../../utils/compactViewport'

export function AudioPlayer({ isQueueHidden = false, onToggleQueue = () => {} }) {
  const { waveformVariant, toggleStep, isStep } = useSuper()
  const { currentFile, handleNextClick, handlePreviousClick, toggleShuffle, isShuffled } =
    useQueue()
  const { togglePlayPause, isPlaying, muted, toggleMute, toggleRepeat, loop } = usePlayback()

  const { progress, duration } = usePlaybackProgress()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const navigate = useNavigate()
  const isCompactHeight = useIsCompactViewportHeight()
  const isCompactWidth = useIsCompactHeaderViewport()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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

  const title = currentFile?.title || currentFile?.fileName || 'Unknown'
  const artist = currentFile?.artist || 'Unknown'
  const shortViews = Number(currentFile?.short_view_count) || 0
  const repeats = Number(currentFile?.consecutive_repeat_count) || 0
  const skips = Number(currentFile?.skip_count) || 0
  const containerFolderName = (() => {
    const filePath = currentFile?.filePath

    if (typeof filePath !== 'string' || !filePath.trim()) {
      return ''
    }

    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
    const pathParts = normalizedPath.split('/').filter(Boolean)

    if (pathParts.length < 2) {
      return ''
    }

    return pathParts[pathParts.length - 2] || ''
  })()

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleLikeClick = (event) => {
    event.stopPropagation()
    toggleLike(currentFile)
  }

  return (
    <div
      className={isCompactWidth ? 'AudioPlayer AudioPlayer--compact-mobile' : 'AudioPlayer'}
      id="AudioPlayer"
    >
      <AudioPlayerProgressRow
        progress={progress}
        duration={duration}
        waveformVariant={waveformVariant}
        formatTime={formatTime}
      />

      <div
        className="AudioPlayer__cover"
        onClick={() => {
          if (currentFile) navigate('/music')
        }}
      >
        <img src={currentCover || undefined} alt="Cover" />
      </div>

      <AudioPlayerMetadata title={title} artist={artist}></AudioPlayerMetadata>

      <div className="AudioPlayer__controls" id="controls">
        <AudioPlayerButton
          onClick={handlePreviousClick}
          variant="default"
          ariaLabel="Previous song"
        >
          <LuSkipBack />
        </AudioPlayerButton>
        <AudioPlayerButton
          onClick={togglePlayPause}
          variant="play"
          ariaLabel={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <LuPause /> : <LuPlay />}
        </AudioPlayerButton>
        <AudioPlayerButton onClick={handleNextClick} variant="default" ariaLabel="Next song">
          <LuSkipForward />
        </AudioPlayerButton>
      </div>

      <div className="AudioPlayer__like-container">
        <div className="Secondary-Controls">
          <AudioPlayerButton
            variant="like"
            className={likeState.currentLike ? 'liked' : ''}
            onClick={handleLikeClick}
            ariaLabel={likeState.currentLike ? 'Remove like' : 'Like song'}
            disabled={!currentFile}
          >
            {likeState.currentLike ? <LuHeart /> : <LuHeartOff />}
          </AudioPlayerButton>

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
                <AudioPlayerButton
                  type="button"
                  variant="menu-panel-item"
                  role="menuitem"
                  onClick={() => runMenuAction(toggleMute)}
                >
                  {muted ? <LuVolumeX /> : <LuVolume2 />}
                  <span>{muted ? 'Unmute' : 'Mute'}</span>
                </AudioPlayerButton>
                <AudioPlayerButton
                  type="button"
                  variant="menu-panel-item"
                  role="menuitem"
                  onClick={() => runMenuAction(toggleStep)}
                >
                  {isStep ? <LuFootprints className="Step" /> : <LuFootprints />}
                  <span>Step</span>
                </AudioPlayerButton>
                <AudioPlayerButton
                  type="button"
                  variant="menu-panel-item"
                  role="menuitem"
                  onClick={() => runMenuAction(toggleShuffle)}
                >
                  <LuShuffle id={isShuffled ? 'btnShuffle-true' : 'btnShuffle-false'} />
                  <span>Shuffle</span>
                </AudioPlayerButton>
                <AudioPlayerButton
                  type="button"
                  variant="menu-panel-item"
                  role="menuitem"
                  onClick={() => runMenuAction(toggleRepeat)}
                >
                  {loop ? <LuRepeat id="btnShuffle-true" /> : <LuRepeat1 id="btnShuffle-false" />}
                  <span>Repeat</span>
                </AudioPlayerButton>
                <AudioPlayerButton
                  type="button"
                  variant="menu-panel-item"
                  role="menuitem"
                  aria-pressed={!isQueueHidden}
                  onClick={() => runMenuAction(onToggleQueue)}
                >
                  <LuListVideo />
                  <span>Queue</span>
                </AudioPlayerButton>
              </div>
            )}

            <div
              className="AudioPlayer__menu-inline"
              role="group"
              aria-label="Secondary player actions"
            >
              <AudioPlayerButton
                type="button"
                variant="inline-action"
                className={isShuffled ? 'is-active' : ''}
                onClick={toggleShuffle}
                title="Shuffle"
              >
                <LuShuffle />
              </AudioPlayerButton>
              <AudioPlayerButton
                type="button"
                variant="inline-action"
                className={isStep ? 'is-active' : ''}
                onClick={toggleStep}
                title="Step"
              >
                <LuFootprints />
              </AudioPlayerButton>
              <AudioPlayerButton
                type="button"
                variant="inline-action"
                className={loop ? 'is-active' : ''}
                onClick={toggleRepeat}
                title="Repeat"
              >
                {loop ? <LuRepeat /> : <LuRepeat1 />}
              </AudioPlayerButton>
              <AudioPlayerButton
                type="button"
                variant="inline-action"
                className={!isQueueHidden ? 'is-active' : ''}
                aria-pressed={!isQueueHidden}
                onClick={onToggleQueue}
                title={isQueueHidden ? 'Show queue panel' : 'Hide queue panel'}
              >
                <LuListVideo />
              </AudioPlayerButton>
            </div>
          </div>
          {!isCompactHeight ? <SliderVolume variant="horizontal" /> : null}
        </div>
      </div>
    </div>
  )
}
