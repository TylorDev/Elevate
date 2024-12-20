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

import './Controls.scss'
import { Button } from '../Button/Button'
import { LuShuffle } from 'react-icons/lu'
import { TbRepeat } from 'react-icons/tb'
import { TbRepeatOff } from 'react-icons/tb'
import { LuListVideo } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useLikes } from '../../Contexts/LikeContext'
import { useSuper } from '../../Contexts/SupeContext'
import { MdDoNotStep, MdOutlineDoNotStep } from 'react-icons/md'

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
    currentFile,
    toggleStep,
    isStep
  } = useSuper()

  const { likeState, toggleLike } = useLikes()

  const { currentLike } = likeState
  const buttonText = currentLike ? <LuHeart /> : <LuHeartOff />
  const navigate = useNavigate()
  return (
    <div className="controls" id="controls">
      <Button onClick={handlePreviousClick} className="btnBack">
        <LuSkipBack />
      </Button>
      <Button className="btnPlay" onClick={togglePlayPause}>
        {isPlaying ? <LuPause /> : <LuPlay />}
      </Button>
      <Button className="btnNext" onClick={handleNextClick}>
        <LuSkipForward />
      </Button>
      <Button
        className={currentLike ? 'btnLike liked' : 'btnLike'}
        onClick={() => {
          toggleLike(currentFile)
        }}
      >
        {' '}
        {buttonText}
      </Button>
      <Button className="btnMute" onClick={toggleMute}>
        {muted ? <LuVolumeX /> : <LuVolume2 />}
      </Button>
      <Button className="btnStep" onClick={toggleStep}>
        {isStep ? <MdDoNotStep className="Step" /> : <MdOutlineDoNotStep />}
      </Button>
      <Button className="btnShuffle" onClick={toggleShuffle}>
        {isShuffled ? <LuShuffle id="btnShuffle-true" /> : <LuShuffle id="btnShuffle-false" />}
      </Button>

      <Button className="btnRepeat" onClick={toggleRepeat}>
        {loop ? <TbRepeat id="btnShuffle-true" /> : <TbRepeatOff id="btnShuffle-false" />}{' '}
      </Button>
      <Button
        className="btnList"
        onClick={() => {
          navigate('/music')
        }}
      >
        <LuListVideo />
      </Button>
    </div>
  )
}
