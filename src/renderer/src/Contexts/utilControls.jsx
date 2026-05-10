// queueUtils.js

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
  currentFile,
  setQueueState,
  setCurrentIndex,
  setIsShuffled
) => {
  const baseQueue = Array.isArray(originalQueue) ? originalQueue : []
  const nextQueue = isShuffled ? [...baseQueue] : [...baseQueue].reverse()
  const activeFilePath = currentFile?.filePath
  const nextIndex = activeFilePath
    ? nextQueue.findIndex((item) => item?.filePath === activeFilePath)
    : -1

  setQueueState((prevState) => ({
    ...prevState,
    currentQueue: nextQueue,
    originalQueue: baseQueue
  }))

  if (nextIndex >= 0) {
    setCurrentIndex(nextIndex)
  } else if (nextQueue.length === 0) {
    setCurrentIndex(0)
  }

  setIsShuffled(!isShuffled)
}
export const ToLike = (currentFile, currentLike, likesong, unlikesong, setCurrentLike) => {
  if (currentFile && currentFile.filePath && currentFile.fileName) {
    if (currentLike) {
      unlikesong(currentFile)
      setCurrentLike(false)
    } else {
      console.log('intern dislike', currentFile)
      likesong(currentFile)
      setCurrentLike(true)
    }
  } else {
    console.error('currentFile is undefined or missing required properties.')
  }
}
