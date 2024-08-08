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
  LuSkipForward
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
    isShuffled
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

      <button
        onClick={() => {
          navigate('/music')
        }}
      >
        <LuListVideo />
      </button>
      <button onClick={toggleRepeat}>
        {loop ? <TbRepeat color="#FF6337" /> : <TbRepeatOff color="#777" />}{' '}
      </button>

      <button onClick={toggleShuffle}>
        {isShuffled ? <LuShuffle color="#FF6337" /> : <LuShuffle color="#777" />}
      </button>
    </div>
  )
}
