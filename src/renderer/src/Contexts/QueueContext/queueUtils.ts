import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type { PlaylistListPayload } from '../../../../main/Types/playlistHandlers.ts'

import type { QueueState } from '../../Types/QueueContextTypes/index.ts'

export function isQueueTrack(value: unknown): value is AudioFileInfo {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.filePath === 'string' && record.filePath.length > 0
}

export function normalizeQueue(value: unknown): AudioFileInfo[] {
  return Array.isArray(value) ? value.filter(isQueueTrack) : []
}

export function findFileIndex(queue: readonly AudioFileInfo[], filePath?: string | null): number {
  if (!filePath) {
    return -1
  }

  return queue.findIndex((file) => file.filePath === filePath)
}

export function getCurrentQueue(queueState: QueueState): AudioFileInfo[] {
  return Array.isArray(queueState.currentQueue) ? queueState.currentQueue : []
}

export function getOriginalQueue(queueState: QueueState): AudioFileInfo[] {
  const currentQueue = getCurrentQueue(queueState)
  return queueState.originalQueue.length > 0 ? queueState.originalQueue : currentQueue
}

export function getNextQueueIndex(index: number, queueLength: number): number {
  return queueLength > 0 ? Math.max(0, Math.min(index, queueLength - 1)) : 0
}

export function appendUniqueTracks(
  originalQueue: readonly AudioFileInfo[],
  songs: readonly AudioFileInfo[]
): AudioFileInfo[] {
  const existingPaths = new Set(originalQueue.map((file) => file.filePath))
  return songs.filter((song) => {
    if (!isQueueTrack(song) || existingPaths.has(song.filePath)) {
      return false
    }

    existingPaths.add(song.filePath)
    return true
  })
}

export function isPlaylistListPayload(value: unknown): value is PlaylistListPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return Array.isArray(record.processedData)
}

export function isSuccessfulResponse(value: unknown): value is { success: true; songName?: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return record.success === true &&
    (record.songName === undefined || typeof record.songName === 'string')
}
