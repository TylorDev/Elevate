/* eslint-disable react/prop-types */
import { useAppContext } from './Contexts/AppContext'
import { LuHeart, LuHeartOff, LuPause, LuPlay, LuSkipBack, LuSkipForward } from 'react-icons/lu'
import { useEffect, useState } from 'react'

export function Controls() {
  const {
    handleNextClick,
    handlePreviousClick,
    togglePlayPause,
    isPlaying,

    currentLike,
    toggleLike
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
    </div>
  )
}
