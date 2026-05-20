import './AudioPlayer.scss'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuHeart, LuHeartOff, LuPause, LuPlay, LuSkipBack, LuSkipForward } from 'react-icons/lu'

import { SliderVolume } from '../SliderVolume/SliderVolume'
import { usePlaybackProgress, useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { PlayerMenu } from './PlayerMenu'
import { AudioPlayerButton } from './AudioPlayerButton'
import { AudioPlayerStats } from './AudioPlayerStats'
import { AudioPlayerMetadata } from './AudioPlayerMetadata'
import { AudioPlayerProgressRow } from './AudioPlayerProgressRow'

export function AudioPlayer({ isQueueHidden = false, onToggleQueue = () => {} }) {
  const { waveformVariant } = useSuper()
  const {
    currentFile,
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

  const { progress, duration } = usePlaybackProgress()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const title = currentFile?.title || currentFile?.fileName || 'Unknown'
  const artist = currentFile?.artist || 'Unknown'
  const shortViews = Number(currentFile?.short_view_count) || 0
  const skips = Number(currentFile?.skip_count) || 0

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

      <AudioPlayerMetadata title={title} artist={artist}>
        <AudioPlayerStats shortViews={shortViews} skips={skips} />
      </AudioPlayerMetadata>

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

          <SliderVolume />

          <PlayerMenu
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            muted={muted}
            toggleMute={toggleMute}
            isStep={isStep}
            toggleStep={toggleStep}
            isShuffled={isShuffled}
            toggleShuffle={toggleShuffle}
            loop={loop}
            toggleRepeat={toggleRepeat}
            isQueueHidden={isQueueHidden}
            onToggleQueue={onToggleQueue}
          />
        </div>
      </div>
    </div>
  )
}
