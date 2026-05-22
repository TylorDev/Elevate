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

const SHUFFLE_WEIGHT_CONFIG = {
  baseWeight: 1,
  favoriteMultiplier: 2,
  retentionBonusMultiplier: 1.5,
  repeatBonusMultiplier: 0.35,
  highSkipRateThreshold: 0.65,
  mediumSkipRateThreshold: 0.4,
  highSkipPenaltyMultiplier: 0.15,
  mediumSkipPenaltyMultiplier: 0.45,
  recentFatigueMs: 2 * 60 * 60 * 1000,
  recentFatigueMultiplier: 0.1,
  todayFatigueMultiplier: 0.5,
  minimumWeight: 0.05
}

function getSafeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function isSameLocalDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function getBaseQueue(queue, originalQueue) {
  if (Array.isArray(originalQueue) && originalQueue.length > 0) {
    return [...originalQueue]
  }

  return Array.isArray(queue) ? [...queue] : []
}

function getShuffleWeight(file, now = Date.now()) {
  const shortViews = getSafeNumber(file?.short_view_count)
  const longViews = getSafeNumber(file?.long_view_count)
  const repeats = getSafeNumber(file?.consecutive_repeat_count)
  const skips = getSafeNumber(file?.skip_count)
  let weight = SHUFFLE_WEIGHT_CONFIG.baseWeight

  if (file?.liked) {
    weight *= SHUFFLE_WEIGHT_CONFIG.favoriteMultiplier
  }

  if (shortViews > 0) {
    const retentionRate = Math.min(longViews / shortViews, 1)
    const skipRate = skips / shortViews

    weight += retentionRate * SHUFFLE_WEIGHT_CONFIG.retentionBonusMultiplier

    if (skipRate >= SHUFFLE_WEIGHT_CONFIG.highSkipRateThreshold) {
      weight *= SHUFFLE_WEIGHT_CONFIG.highSkipPenaltyMultiplier
    } else if (skipRate >= SHUFFLE_WEIGHT_CONFIG.mediumSkipRateThreshold) {
      weight *= SHUFFLE_WEIGHT_CONFIG.mediumSkipPenaltyMultiplier
    }
  }

  if (repeats > 0) {
    weight += Math.log1p(repeats) * SHUFFLE_WEIGHT_CONFIG.repeatBonusMultiplier
  }

  if (file?.lastPlayedAt) {
    const lastPlayedAt = new Date(file.lastPlayedAt)

    if (!Number.isNaN(lastPlayedAt.getTime())) {
      const ageMs = now - lastPlayedAt.getTime()

      if (ageMs >= 0 && ageMs < SHUFFLE_WEIGHT_CONFIG.recentFatigueMs) {
        weight *= SHUFFLE_WEIGHT_CONFIG.recentFatigueMultiplier
      } else if (isSameLocalDay(lastPlayedAt, new Date(now))) {
        weight *= SHUFFLE_WEIGHT_CONFIG.todayFatigueMultiplier
      }
    }
  }

  return Math.max(weight, SHUFFLE_WEIGHT_CONFIG.minimumWeight)
}

function weightedShuffle(queue) {
  const now = Date.now()

  return queue
    .map((file, index) => {
      const weight = getShuffleWeight(file, now)
      const randomRoll = Math.max(Math.random(), Number.EPSILON)

      return {
        file,
        index,
        score: Math.pow(randomRoll, 1 / weight)
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map(({ file }) => file)
}

export function createWeightedShuffledQueue(queue, currentFile = null) {
  const baseQueue = Array.isArray(queue) ? [...queue] : []

  if (baseQueue.length <= 1) {
    return baseQueue
  }

  const activeFilePath = currentFile?.filePath

  if (!activeFilePath) {
    return weightedShuffle(baseQueue)
  }

  const activeIndex = baseQueue.findIndex((file) => file?.filePath === activeFilePath)

  if (activeIndex < 0) {
    return weightedShuffle(baseQueue)
  }

  const activeSong = baseQueue[activeIndex]
  const remainingQueue = baseQueue.filter((_, index) => index !== activeIndex)

  return [activeSong, ...weightedShuffle(remainingQueue)]
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
