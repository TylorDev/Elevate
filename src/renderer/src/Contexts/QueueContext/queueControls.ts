import type { Dispatch, SetStateAction } from 'react'

import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  QueueControlActions,
  QueueControlDependencies
} from '../../Types/QueueContextTypes/index.ts'

export const goToPrevious = (
  currentIndex: number,
  queue: AudioFileInfo[],
  setCurrentIndex: Dispatch<SetStateAction<number>>,
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
): void => {
  const newIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1
  setCurrentIndex(newIndex)
  setCurrentFile(queue[newIndex] ?? null)
}

export const goToNext = (
  currentIndex: number,
  queue: AudioFileInfo[],
  setCurrentIndex: Dispatch<SetStateAction<number>>,
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
): void => {
  const newIndex = currentIndex === queue.length - 1 ? 0 : currentIndex + 1
  setCurrentIndex(newIndex)
  setCurrentFile(queue[newIndex] ?? null)
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

function getSafeNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function getBaseQueue(queue: AudioFileInfo[], originalQueue: AudioFileInfo[]): AudioFileInfo[] {
  return originalQueue.length > 0 ? [...originalQueue] : [...queue]
}

function getShuffleWeight(file: AudioFileInfo, now = Date.now()): number {
  const shortViews = getSafeNumber(file.short_view_count)
  const longViews = getSafeNumber(file.long_view_count)
  const repeats = getSafeNumber(file.consecutive_repeat_count)
  const skips = getSafeNumber(file.skip_count)
  let weight = SHUFFLE_WEIGHT_CONFIG.baseWeight

  if (file.liked) {
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

  if (file.lastPlayedAt) {
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

function weightedShuffle(queue: AudioFileInfo[]): AudioFileInfo[] {
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

export function createWeightedShuffledQueue(
  queue: AudioFileInfo[],
  currentFile: AudioFileInfo | null = null
): AudioFileInfo[] {
  const baseQueue = [...queue]

  if (baseQueue.length <= 1) {
    return baseQueue
  }

  const activeFilePath = currentFile?.filePath

  if (!activeFilePath) {
    return weightedShuffle(baseQueue)
  }

  const activeIndex = baseQueue.findIndex((file) => file.filePath === activeFilePath)

  if (activeIndex < 0) {
    return weightedShuffle(baseQueue)
  }

  const activeSong = baseQueue[activeIndex]
  const remainingQueue = baseQueue.filter((_, index) => index !== activeIndex)

  return [activeSong, ...weightedShuffle(remainingQueue)]
}

export function createQueueControlActions({
  queueState,
  currentFile,
  currentIndex,
  isShuffled,
  setQueueState,
  setCurrentFile,
  setCurrentIndex,
  setIsShuffled,
  navigateToMusic
}: QueueControlDependencies): QueueControlActions {
  const handlePreviousClick = (): void => {
    if (currentIndex > 0) {
      goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }

  const handleNextClick = (): void => {
    if (queueState.currentQueue.length > 0) {
      goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }

  const toggleShuffle = (): void => {
    const baseQueue = getBaseQueue(queueState.currentQueue, queueState.originalQueue)
    const activeFilePath = currentFile?.filePath
    const nextQueue = isShuffled ? [...baseQueue] : createWeightedShuffledQueue(baseQueue, currentFile)
    const nextIndex = activeFilePath
      ? nextQueue.findIndex((item) => item.filePath === activeFilePath)
      : -1

    setQueueState((previousState) => ({
      ...previousState,
      currentQueue: nextQueue,
      originalQueue: baseQueue
    }))

    if (nextIndex >= 0) {
      setCurrentFile(nextQueue[nextIndex] ?? null)
      setCurrentIndex(nextIndex)
    } else if (!activeFilePath && nextQueue.length > 0 && !isShuffled) {
      setCurrentIndex(0)
    } else if (nextQueue.length === 0) {
      setCurrentFile(null)
      setCurrentIndex(0)
    }

    setIsShuffled(!isShuffled)
    navigateToMusic()
  }

  return { handleNextClick, handlePreviousClick, toggleShuffle }
}
