import type { AudioFileInfo } from '../../Types/filehandlers.ts'
import type {
  EmptyLaunchPayload,
  LaunchPayload,
  LaunchPayloadSummary,
  PlaybackLaunchKind
} from '../../Types/argv.ts'

export const WINDOWS_OPEN_BATCH_MS = 450

export function createEmptyPayload(): EmptyLaunchPayload {
  return {
    kind: 'empty',
    files: [],
    directories: [],
    songs: [],
    hasDirectories: false,
    queueName: '',
    startIndex: 0
  }
}

export function getQueueName(
  kind: PlaybackLaunchKind | 'empty',
  files: string[],
  directories: string[]
): string {
  if (kind === 'single-file') {
    return files[0] || ''
  }

  if (kind === 'directory') {
    return directories[0] || ''
  }

  return 'Argv Queue'
}

export function getPayloadKind(
  files: string[],
  directories: string[]
): PlaybackLaunchKind | 'empty' {
  if (directories.length === 1 && files.length === 0) {
    return 'directory'
  }

  if (directories.length === 0 && files.length === 1) {
    return 'single-file'
  }

  if (directories.length === 0 && files.length > 1) {
    return 'multi-file'
  }

  if (directories.length > 0 || files.length > 0) {
    return 'mixed'
  }

  return 'empty'
}

export function appendUniqueSongs(
  targetSongs: AudioFileInfo[],
  incomingSongs: AudioFileInfo[],
  seenSongPaths: Set<string>
): void {
  for (const song of incomingSongs) {
    if (!song?.filePath || seenSongPaths.has(song.filePath)) {
      continue
    }

    seenSongPaths.add(song.filePath)
    targetSongs.push(song)
  }
}

export function summarizePayload(payload: LaunchPayload): LaunchPayloadSummary {
  return {
    kind: payload.kind,
    files: payload.files?.length || 0,
    directories: payload.directories?.length || 0,
    songs: payload.songs?.length || 0,
    queueName: payload.queueName,
    playlistPath: payload.kind === 'playlist-import' ? payload.playlistPath : null
  }
}
