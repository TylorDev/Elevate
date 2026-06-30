import { importPlaylistFile } from '../playlistHandlers/index.ts'
import { getFileInfos } from '../../utils/utils.ts'
import { addDirectoryToLibrary } from '../../utils/libraryIngestion.ts'
import { resolveImportableAudioPaths } from '../../utils/mediaFileSupport.ts'
import { normalizeLaunchEntries } from './entries.ts'
import {
  appendUniqueSongs,
  createEmptyPayload,
  getPayloadKind,
  getQueueName,
  summarizePayload
} from './shared.ts'
import type { AudioFileInfo } from '../../Types/filehandlers.ts'
import type {
  DirectoryImportResult,
  LaunchEntry,
  LaunchPayload,
  LaunchProcessingOptions,
  NotifyLaunchRenderer,
  ProcessLaunchArgsOptions
} from '../../Types/argv.ts'

const getAudioFileInfos = getFileInfos as (filePaths: string[]) => Promise<AudioFileInfo[]>
const resolveAudioPaths = resolveImportableAudioPaths as (filePaths: string[]) => Promise<string[]>
const importDirectory = addDirectoryToLibrary as (
  rootPath: string,
  options: Required<LaunchProcessingOptions>
) => Promise<DirectoryImportResult>

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string' && message) {
      return message
    }
  }

  return 'No se pudo importar la playlist.'
}

export async function processLaunchEntries(
  orderedEntries: LaunchEntry[],
  { notifyRenderer = () => {}, invalidateDirectoryCache = () => {} }: LaunchProcessingOptions = {}
): Promise<LaunchPayload> {
  if (orderedEntries.length === 0) {
    return createEmptyPayload()
  }

  const files: string[] = []
  const directories: string[] = []
  const songs: AudioFileInfo[] = []
  const seenSongPaths = new Set<string>()
  const playlistEntries = orderedEntries.filter((entry) => entry.type === 'playlist')

  if (playlistEntries.length === 1 && orderedEntries.length === 1) {
    let importedPlaylist

    try {
      importedPlaylist = await importPlaylistFile(playlistEntries[0].path)
    } catch (error) {
      notifyRenderer({
        type: 'toast',
        variant: 'error',
        message: getErrorMessage(error)
      })
      return createEmptyPayload()
    }

    if (!importedPlaylist.success) {
      notifyRenderer({
        type: 'toast',
        variant: 'error',
        message: importedPlaylist.error || 'No se pudo importar la playlist.'
      })
      return createEmptyPayload()
    }

    notifyRenderer({
      type: 'toast',
      variant: 'success',
      message: `Playlist importada: ${importedPlaylist.playlistName}`
    })

    return {
      kind: 'playlist-import',
      files: [],
      directories: [],
      songs: [],
      hasDirectories: false,
      queueName: importedPlaylist.playlistName || importedPlaylist.path,
      startIndex: 0,
      playlistPath: importedPlaylist.path,
      playlistName: importedPlaylist.playlistName
    }
  }

  const filePaths = orderedEntries
    .filter((entry) => entry.type === 'file')
    .map((entry) => entry.path)

  if (filePaths.length > 0) {
    const importableFilePaths = await resolveAudioPaths(filePaths)
    files.push(...importableFilePaths)
    const fileSongs = await getAudioFileInfos(importableFilePaths)
    appendUniqueSongs(songs, fileSongs, seenSongPaths)
  }

  const directoryEntries = orderedEntries.filter((entry) => entry.type === 'directory')
  for (const entry of directoryEntries) {
    directories.push(entry.path)
    const result = await importDirectory(entry.path, {
      notifyRenderer,
      invalidateDirectoryCache
    })

    if (result.success && result.songs.length) {
      appendUniqueSongs(songs, result.songs, seenSongPaths)
    }
  }

  const kind = getPayloadKind(files, directories)
  if (kind === 'empty') {
    return {
      kind,
      files,
      directories,
      songs,
      hasDirectories: false,
      queueName: getQueueName(kind, files, directories),
      startIndex: 0
    }
  }

  return {
    kind,
    files,
    directories,
    songs,
    hasDirectories: directories.length > 0,
    queueName: getQueueName(kind, files, directories),
    startIndex: 0
  }
}

export async function processLaunchArgs(
  rawArgs: readonly unknown[],
  {
    workingDirectory = process.cwd(),
    notifyRenderer = (() => {}) as NotifyLaunchRenderer,
    invalidateDirectoryCache = () => {}
  }: ProcessLaunchArgsOptions = {}
): Promise<LaunchPayload> {
  const orderedEntries = normalizeLaunchEntries(rawArgs, workingDirectory)

  console.info('[argv/main] normalized launch entries', {
    rawArgs,
    workingDirectory,
    entries: orderedEntries
  })

  const payload = await processLaunchEntries(orderedEntries, {
    notifyRenderer,
    invalidateDirectoryCache
  })

  console.info('[argv/main] processed launch payload', summarizePayload(payload))
  return payload
}
