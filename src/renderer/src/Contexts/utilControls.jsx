// queueUtils.js

import { shuffleArray } from './utils'

export const goToPrevious = (currentIndex, queue, setCurrentIndex, setCurrentFile) => {
  const newIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1
  setCurrentIndex(newIndex)
  setCurrentFile(queue[newIndex])
}

export const goToNext = (currentIndex, queue, setCurrentIndex, setCurrentFile) => {
  const newIndex = currentIndex === queue.length - 1 ? 0 : currentIndex + 1
  setCurrentIndex(newIndex)
  setCurrentFile(queue[newIndex])
}

// mediaUtils.js

export const toPlay = (mediaRef, isPlaying) => {
  if (mediaRef.current) {
    if (isPlaying) {
      mediaRef.current.pause()
    } else {
      mediaRef.current.play()
    }
  }
}

export const toMute = (mediaRef, muted, setMuted) => {
  if (mediaRef.current) {
    const newMuteState = !muted
    mediaRef.current.muted = newMuteState
    setMuted(newMuteState)
  }
}

export const toRepeat = (mediaRef, loop, setLoop) => {
  if (mediaRef.current) {
    const newLoopState = !loop
    mediaRef.current.loop = newLoopState
    setLoop(newLoopState)
    console.log(newLoopState)
  }
}

export const toShuffle = (
  isShuffled,
  queue,
  originalQueue,
  currentIndex,
  setQueue,
  setIsShuffled
) => {
  if (isShuffled) {
    setQueue(originalQueue)
  } else {
    const shuffledQueue = shuffleArray(queue, currentIndex)
    setQueue(shuffledQueue)
  }
  setIsShuffled(!isShuffled)
}
export const ToLike = (currentFile, currentLike, likesong, unlikesong, setCurrentLike) => {
  if (currentFile && currentFile.filePath && currentFile.fileName) {
    if (currentLike) {
      unlikesong(currentFile)
      setCurrentLike(false)
    } else {
      likesong(currentFile)
      setCurrentLike(true)
    }
  } else {
    console.error('currentFile is undefined or missing required properties.')
  }
}
