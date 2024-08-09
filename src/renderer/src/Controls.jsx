/* eslint-disable react/prop-types */
import { useAppContext } from './Contexts/AppContext'
import { TbRepeat, TbRepeatOff, TbTrendingDown2 } from 'react-icons/tb'
import {
  LuCornerDownRight,
  LuHeart,
  LuHeartOff,
  LuListVideo,
  LuPause,
  LuPlay,
  LuRepeat,
  LuRepeat1,
  LuShuffle,
  LuSkipBack,
  LuSkipForward,
  LuVolume2,
  LuVolumeX
} from 'react-icons/lu'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Controls() {
  const {
    handleNextClick,
    handlePreviousClick,
    togglePlayPause,
    isPlaying,
    loop,
    currentLike,
    toggleLike,
    toggleRepeat,
    toggleShuffle,
    isShuffled,
    muted,
    toggleMute
  } = useAppContext()
  const navigate = useNavigate()
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
