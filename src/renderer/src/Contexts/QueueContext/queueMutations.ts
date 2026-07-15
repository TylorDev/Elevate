import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  QueueMutationActions,
  QueueMutationDependencies
} from '../../Types/QueueContextTypes/index.ts'
import { createDisplayedQueue } from './queueState.ts'
import { getOriginalQueue, isSuccessfulResponse } from './queueUtils.ts'
import { removeTrackFromQueue } from './queueState.ts'

export function createQueueMutations({
  currentFile,
  currentIndex,
  isShuffled,
  invoke,
  setQueueState,
  setCurrentFile,
  setCurrentIndex,
  notify
}: QueueMutationDependencies): QueueMutationActions {
  const removeTrack = async (playlistPath: string, index: number): Promise<void> => {
    const response = await invoke('update-list', {
      filePath: playlistPath,
      index
    })

    if (!isSuccessfulResponse(response)) {
      return
    }

    setQueueState((previousState) => {
      const result = removeTrackFromQueue(previousState, currentFile, currentIndex, index)

      if (!result) {
        return previousState
      }

      setCurrentFile(result.currentFile)
      setCurrentIndex(result.currentIndex)
      notify.notifyRemoved(1000)
      return result.queueState
    })
  }

  const addSong = async (playlistPath: string, newTrack: AudioFileInfo): Promise<void> => {
    const response = await invoke('add-new-song', {
      filePath: playlistPath,
      song: newTrack.filePath
    })

    if (!isSuccessfulResponse(response)) {
      return
    }

    const songName = response.songName ?? newTrack.fileName

    setQueueState((previousState) => {
      const originalQueue = getOriginalQueue(previousState)
      const nextOriginalQueue = [...originalQueue, newTrack]
      const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

      return {
        ...previousState,
        currentQueue: nextQueue,
        originalQueue: nextOriginalQueue
      }
    })
    notify.notifySongAdded(songName)
  }

  return { removeTrack, addSong }
}
