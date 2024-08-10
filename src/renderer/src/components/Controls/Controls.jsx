/* eslint-disable react/prop-types */

import {
  LuHeart,
  LuHeartOff,
  LuPause,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuVolume2,
  LuVolumeX
} from 'react-icons/lu'
import { useAppContext } from '../../Contexts/AppContext'

export function Controls() {
  const {
    handleNextClick,
    handlePreviousClick,
    togglePlayPause,
    isPlaying,

    currentLike,
    toggleLike,
    muted,
    toggleMute
  } = useAppContext()

  const buttonText = currentLike ? <LuHeart /> : <LuHeartOff />

  return (
    <div className="controls">
      <button onClick={handlePreviousClick}>
        <LuSkipBack />
      </button>
      <button onClick={togglePlayPause}>{isPlaying ? <LuPause /> : <LuPlay />}</button>
      <button onClick={handleNextClick}>
        <LuSkipForward />
      </button>
      <button className={currentLike ? 'liked' : ''} onClick={toggleLike}>
        {' '}
        {buttonText}
      </button>
      <button className="mutebtn" onClick={toggleMute}>
        {muted ? <LuVolumeX /> : <LuVolume2 />}
      </button>
    </div>
  )
}
