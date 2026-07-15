import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  QueueStateActions,
  QueueState,
  QueueStateDependencies
} from '../../Types/QueueContextTypes/index.ts'
import { createWeightedShuffledQueue } from './queueControls.ts'
import {
  appendUniqueTracks,
  findFileIndex,
  getNextQueueIndex,
  getOriginalQueue,
  normalizeQueue
} from './queueUtils.ts'

export function createDisplayedQueue(
  baseQueue: readonly AudioFileInfo[],
  shuffledActive: boolean,
  currentFile: AudioFileInfo | null
): AudioFileInfo[] {
  const nextBaseQueue = [...baseQueue]
  return shuffledActive
    ? createWeightedShuffledQueue(nextBaseQueue, currentFile)
    : nextBaseQueue
}

export type QueueRemovalResult = {
  queueState: {
    currentQueue: AudioFileInfo[]
    originalQueue: AudioFileInfo[]
    queueName: string
  }
  currentFile: AudioFileInfo | null
  currentIndex: number
  removedFile: AudioFileInfo
}

export function removeTrackFromQueue(
  queueState: QueueState,
  currentFile: AudioFileInfo | null,
  currentIndex: number,
  index: number
): QueueRemovalResult | null {
  const currentQueue = queueState.currentQueue

  if (!Number.isInteger(index) || index < 0 || index >= currentQueue.length) {
    return null
  }

  const removedFile = currentQueue[index]
  const nextCurrentQueue = currentQueue.filter((_, itemIndex) => itemIndex !== index)
  const originalQueue = queueState.originalQueue.length > 0
    ? queueState.originalQueue
    : currentQueue
  let removedOriginal = false
  const nextOriginalQueue = originalQueue.filter((file) => {
    if (!removedOriginal && file.filePath === removedFile.filePath) {
      removedOriginal = true
      return false
    }

    return true
  })

  let nextCurrentFile = currentFile
  let nextCurrentIndex = currentIndex

  if (nextCurrentQueue.length === 0) {
    nextCurrentFile = null
    nextCurrentIndex = 0
  } else if (currentIndex === index) {
    nextCurrentIndex = getNextQueueIndex(index, nextCurrentQueue.length)
    nextCurrentFile = nextCurrentQueue[nextCurrentIndex] ?? null
  } else if (currentIndex > index) {
    nextCurrentIndex = currentIndex - 1
    nextCurrentFile = nextCurrentQueue[nextCurrentIndex] ?? nextCurrentQueue[0] ?? null
  } else {
    const activeIndex = findFileIndex(nextCurrentQueue, currentFile?.filePath)

    if (activeIndex >= 0) {
      nextCurrentFile = nextCurrentQueue[activeIndex]
      nextCurrentIndex = activeIndex
    }
  }

  return {
    queueState: {
      ...queueState,
      currentQueue: nextCurrentQueue,
      originalQueue: nextOriginalQueue
    },
    currentFile: nextCurrentFile,
    currentIndex: nextCurrentIndex,
    removedFile
  }
}

export function createQueueStateActions({
  currentFile,
  currentIndex,
  isShuffled,
  setQueueState,
  setCurrentFile,
  setCurrentIndex,
  setIsShuffled,
  notifyRemoved
}: QueueStateDependencies): QueueStateActions {
  const resetShuffleState = (): void => {
    setIsShuffled(false)
  }

  const applyBaseQueue = (
    list: AudioFileInfo[],
    name: string,
    index: number | null = null
  ): void => {
    const baseQueue = normalizeQueue(list)
    const hasExplicitIndex =
      index !== null &&
      index !== undefined &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < baseQueue.length
    const nextIndex = hasExplicitIndex ? index : 0
    const nextFile = baseQueue[nextIndex] ?? null

    resetShuffleState()
    setQueueState({
      currentQueue: baseQueue,
      originalQueue: baseQueue,
      queueName: name
    })
    setCurrentFile(nextFile)
    setCurrentIndex(baseQueue.length > 0 ? nextIndex : 0)
  }

  const PlayQueue = (list: AudioFileInfo[], name: string, index: number | null = null): void => {
    applyBaseQueue(list, name, index)
  }

  const playQueueShuffled = (list: AudioFileInfo[], name: string): void => {
    const baseQueue = normalizeQueue(list)
    const shuffledQueue = createWeightedShuffledQueue(baseQueue)

    setQueueState({
      currentQueue: shuffledQueue,
      originalQueue: baseQueue,
      queueName: name
    })
    setIsShuffled(true)
    setCurrentFile(shuffledQueue[0] ?? null)
    setCurrentIndex(0)
  }

  const appendToCurrentQueue = (song: AudioFileInfo): void => {
    if (!song?.filePath) {
      return
    }

    setQueueState((previousState) => {
      const previousOriginalQueue = getOriginalQueue(previousState)
      const nextOriginalQueue = [...previousOriginalQueue, song]
      const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

      return {
        queueName: previousState.queueName || 'search-results',
        currentQueue: nextQueue,
        originalQueue: nextOriginalQueue
      }
    })
  }

  const appendManyToCurrentQueue = (songs: AudioFileInfo[] = []): void => {
    const normalizedSongs = normalizeQueue(songs)

    if (normalizedSongs.length === 0) {
      return
    }

    setQueueState((previousState) => {
      const previousOriginalQueue = getOriginalQueue(previousState)
      const songsToAppend = appendUniqueTracks(previousOriginalQueue, normalizedSongs)

      if (songsToAppend.length === 0) {
        return previousState
      }

      const nextOriginalQueue = [...previousOriginalQueue, ...songsToAppend]
      const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

      return {
        queueName: previousState.queueName || 'search-results',
        currentQueue: nextQueue,
        originalQueue: nextOriginalQueue
      }
    })
  }

  const appendToQueueAndPlay = (song: AudioFileInfo): void => {
    if (!song?.filePath) {
      return
    }

    setQueueState((previousState) => {
      const previousOriginalQueue = getOriginalQueue(previousState)
      const nextOriginalQueue = [...previousOriginalQueue, song]
      const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, song)
      const nextIndex = findFileIndex(nextQueue, song.filePath)

      setCurrentFile(nextQueue[nextIndex] ?? song)
      setCurrentIndex(nextIndex >= 0 ? nextIndex : 0)

      return {
        queueName: previousState.queueName || 'search-results',
        currentQueue: nextQueue,
        originalQueue: nextOriginalQueue
      }
    })
  }

  const removeFromCurrentQueue = (index: number): void => {
    setQueueState((previousState) => {
      const result = removeTrackFromQueue(previousState, currentFile, currentIndex, index)

      if (!result) {
        return previousState
      }

      setCurrentFile(result.currentFile)
      setCurrentIndex(result.currentIndex)
      notifyRemoved()
      return result.queueState
    })
  }

  const reorderCurrentQueue = (nextBaseQueue: AudioFileInfo[]): void => {
    const baseQueue = normalizeQueue(nextBaseQueue)
    const displayedQueue = createDisplayedQueue(baseQueue, isShuffled, currentFile)
    const activeIndex = findFileIndex(displayedQueue, currentFile?.filePath)

    setQueueState((previousState) => ({
      ...previousState,
      currentQueue: displayedQueue,
      originalQueue: baseQueue
    }))

    if (activeIndex >= 0) {
      setCurrentFile(displayedQueue[activeIndex])
      setCurrentIndex(activeIndex)
      return
    }

    if (displayedQueue.length === 0) {
      setCurrentFile(null)
      setCurrentIndex(0)
      return
    }

    const fallbackIndex = getNextQueueIndex(currentIndex, displayedQueue.length)
    setCurrentFile(displayedQueue[fallbackIndex] ?? null)
    setCurrentIndex(fallbackIndex)
  }

  const handleSongClick = (
    file: AudioFileInfo,
    index: number,
    list: AudioFileInfo[],
    name: string
  ): void => {
    applyBaseQueue(list, name, index)
    setCurrentFile(file)
    setCurrentIndex(index)
  }

  return {
    PlayQueue,
    playQueueShuffled,
    appendToCurrentQueue,
    appendManyToCurrentQueue,
    appendToQueueAndPlay,
    removeFromCurrentQueue,
    reorderCurrentQueue,
    handleSongClick,
    applyBaseQueue
  }
}
