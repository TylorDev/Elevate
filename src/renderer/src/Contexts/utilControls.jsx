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

function getShortViewCount(file) {
  const shortViewCount = Number(file?.short_view_count)
  return Number.isFinite(shortViewCount) ? shortViewCount : 0
}

function shuffleGroup(group) {
  const nextGroup = [...group]

  for (let index = nextGroup.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[nextGroup[index], nextGroup[randomIndex]] = [nextGroup[randomIndex], nextGroup[index]]
  }

  return nextGroup
}

function getBaseQueue(queue, originalQueue) {
  if (Array.isArray(originalQueue) && originalQueue.length > 0) {
    return [...originalQueue]
  }

  return Array.isArray(queue) ? [...queue] : []
}

function groupAndShuffleByShortViews(queue) {
  const groups = new Map()

  for (const file of queue) {
    const shortViewCount = getShortViewCount(file)
    const currentGroup = groups.get(shortViewCount) || []
    currentGroup.push(file)
    groups.set(shortViewCount, currentGroup)
  }

  return Array.from(groups.keys())
    .sort((left, right) => left - right)
    .flatMap((shortViewCount) => shuffleGroup(groups.get(shortViewCount) || []))
}

export function createWeightedShuffledQueue(queue, currentFile = null) {
  const baseQueue = Array.isArray(queue) ? [...queue] : []

  if (baseQueue.length <= 1) {
    return baseQueue
  }

  const activeFilePath = currentFile?.filePath

  if (!activeFilePath) {
    return groupAndShuffleByShortViews(baseQueue)
  }

  const activeIndex = baseQueue.findIndex((file) => file?.filePath === activeFilePath)

  if (activeIndex < 0) {
    return groupAndShuffleByShortViews(baseQueue)
  }

  const activeSong = baseQueue[activeIndex]
  const remainingQueue = baseQueue.filter((_, index) => index !== activeIndex)

  return [activeSong, ...groupAndShuffleByShortViews(remainingQueue)]
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
  setCurrentFile,
  setCurrentIndex,
  setIsShuffled
) => {
  const baseQueue = getBaseQueue(queue, originalQueue)
  const activeFilePath = currentFile?.filePath
  const nextQueue = isShuffled
    ? [...baseQueue]
    : createWeightedShuffledQueue(baseQueue, currentFile)
  const nextIndex = activeFilePath ? nextQueue.findIndex((item) => item?.filePath === activeFilePath) : -1

  setQueueState((prevState) => ({
    ...prevState,
    currentQueue: nextQueue,
    originalQueue: baseQueue
  }))

  if (nextIndex >= 0) {
    setCurrentFile(nextQueue[nextIndex])
    setCurrentIndex(nextIndex)
  } else if (!activeFilePath && nextQueue.length > 0 && !isShuffled) {
    setCurrentIndex(0)
  } else if (nextQueue.length === 0) {
    setCurrentFile('')
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
