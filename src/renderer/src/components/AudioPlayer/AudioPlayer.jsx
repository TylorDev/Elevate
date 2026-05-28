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
  LuVolumeX,
  LuPictureInPicture2
} from 'react-icons/lu'

import { SliderVolume } from '../SliderVolume/SliderVolume'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaybackProgress } from '../../Contexts/PlaybackProgressContext'
import { usePlayback } from '../../Contexts/PlaybackContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'

import { AudioPlayerButton } from './AudioPlayerButton'
import { PlayerMenu } from './PlayerMenu'

import { AudioPlayerMetadata } from './AudioPlayerMetadata'
import { AudioPlayerProgressRow } from './AudioPlayerProgressRow'

export function AudioPlayer({ isQueueHidden = false, onToggleQueue = () => {} }) {
  const { waveformVariant, toggleStep, isStep } = useSuper()
  const { currentFile, handleNextClick, handlePreviousClick, toggleShuffle, isShuffled } =
    useQueue()
  const { togglePlayPause, isPlaying, muted, toggleMute, toggleRepeat, loop } = usePlayback()

  const { progress, duration } = usePlaybackProgress()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    <div className="AudioPlayer" id="AudioPlayer">
      <div className="AudioPlayer__col-1">
        <div
          className="AudioPlayer__cover"
          onClick={() => {
            if (currentFile) navigate('/music')
          }}
        >
          <img src={currentCover || undefined} alt="Cover" />
        </div>

        <div className="AudioPlayer__info">
          <AudioPlayerMetadata title={title} artist={artist}></AudioPlayerMetadata>

          <div className="AudioPlayer__actions-row">
            <AudioPlayerButton
              variant="like"
              className={likeState.currentLike ? 'liked' : ''}
              onClick={handleLikeClick}
              ariaLabel={likeState.currentLike ? 'Remove like' : 'Like song'}
              disabled={!currentFile}
            >
              {likeState.currentLike ? <LuHeart /> : <LuHeartOff />}
            </AudioPlayerButton>
          </div>
        </div>
      </div>

      <div className="AudioPlayer__col-2">
        <AudioPlayerProgressRow
          progress={progress}
          duration={duration}
          waveformVariant={waveformVariant}
          formatTime={formatTime}
        />

        <div className="AudioPlayer__controls" id="controls">
          <AudioPlayerButton
            onClick={toggleShuffle}
            variant="default"
            ariaLabel="Shuffle"
            className={isShuffled ? 'is-active' : ''}
          >
            <LuShuffle id={isShuffled ? 'btnShuffle-true' : 'btnShuffle-false'} />
          </AudioPlayerButton>

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

          <AudioPlayerButton
            onClick={toggleRepeat}
            variant="default"
            ariaLabel="Repeat"
            className={loop ? 'is-active' : ''}
          >
            {loop ? <LuRepeat id="btnShuffle-true" /> : <LuRepeat1 id="btnShuffle-false" />}
          </AudioPlayerButton>
        </div>
      </div>

      <div className="AudioPlayer__col-3">
        <div className="AudioPlayer__volume-wrapper">
          <SliderVolume variant={windowWidth <= 800 ? 'popup' : 'horizontal'} />
        </div>

        <AudioPlayerButton
          variant="default"
          onClick={onToggleQueue}
          ariaLabel={isQueueHidden ? 'Show queue panel' : 'Hide queue panel'}
          className={!isQueueHidden ? 'is-active' : ''}
        >
          <LuListVideo />
        </AudioPlayerButton>

        <AudioPlayerButton variant="default" ariaLabel="Picture in Picture">
          <LuPictureInPicture2 />
        </AudioPlayerButton>
      </div>
    </div>
  )
}
