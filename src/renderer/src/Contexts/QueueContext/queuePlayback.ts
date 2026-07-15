import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  QueueNavigationOptions,
  QueuePlaybackActions,
  QueuePlaybackDependencies
} from '../../Types/QueueContextTypes/index.ts'
import { getNextQueueIndex, isPlaylistListPayload } from './queueUtils.ts'
import { normalizeQueue } from './queueUtils.ts'

export function createQueuePlaybackActions({
  applyBaseQueue,
  invoke,
  navigate,
  setCurrentFile,
  setCurrentIndex
}: QueuePlaybackDependencies): QueuePlaybackActions {
  const openDirectoryQueue = async (
    directoryPath: string,
    { shouldNavigate = true }: QueueNavigationOptions = {}
  ): Promise<AudioFileInfo[]> => {
    if (!directoryPath) {
      return []
    }

    const response = await invoke('get-audio-in-directory', directoryPath)
    const nextQueue = normalizeQueue(response)

    if (nextQueue.length === 0) {
      return []
    }

    applyBaseQueue(nextQueue, `folder:${directoryPath}`, 0)

    if (shouldNavigate) {
      navigate(`/directories/${encodeURIComponent(directoryPath)}/false`)
    }

    return nextQueue
  }

  const handleQueueAndPlay = async (
    song: AudioFileInfo | undefined = undefined,
    index: number | undefined = undefined,
    filePath?: string,
    shouldNavigate = true
  ): Promise<void> => {
    if (!filePath) {
      return
    }

    if (filePath.startsWith('folder:')) {
      const newFilePath = filePath.replace(/^folder:/, '')
      await openDirectoryQueue(newFilePath, { shouldNavigate })

      if (song && typeof index === 'number') {
        setCurrentFile(song)
        setCurrentIndex(index)
      }

      return
    }

    try {
      const response = await invoke('get-list', filePath)

      if (!isPlaylistListPayload(response)) {
        console.error('Playlist response does not contain a valid processed queue')
        return
      }

      const processedQueue = normalizeQueue(response.processedData)
      const requestedIndex = typeof index === 'number' ? index : 0
      const nextIndex = getNextQueueIndex(requestedIndex, processedQueue.length)

      applyBaseQueue(processedQueue, filePath, nextIndex)

      if (shouldNavigate) {
        navigate(`/playlists/${filePath}`)
      }

      if (processedQueue.length > 0) {
        setCurrentFile(song ?? processedQueue[nextIndex] ?? processedQueue[0])
        setCurrentIndex(nextIndex)
      } else {
        console.error('Processed queue is empty')
      }
    } catch (error) {
      console.error('Error handling queue or file infos:', error)
    }
  }

  return { openDirectoryQueue, handleQueueAndPlay }
}
