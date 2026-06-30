import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { AudioFileInfo, MaybePromise } from './filehandlers.ts'

export type LaunchEntryType = 'file' | 'directory' | 'playlist'

export type LaunchEntry = {
  type: LaunchEntryType
  path: string
}

export type PlaybackLaunchKind = 'single-file' | 'multi-file' | 'directory' | 'mixed'

export type LaunchPayloadKind = PlaybackLaunchKind | 'empty' | 'playlist-import'

export type EmptyLaunchPayload = {
  kind: 'empty'
  files: string[]
  directories: string[]
  songs: AudioFileInfo[]
  hasDirectories: false
  queueName: string
  startIndex: number
}

export type PlaybackLaunchPayload = {
  kind: PlaybackLaunchKind
  files: string[]
  directories: string[]
  songs: AudioFileInfo[]
  hasDirectories: boolean
  queueName: string
  startIndex: number
}

export type PlaylistImportLaunchPayload = {
  kind: 'playlist-import'
  files: string[]
  directories: string[]
  songs: AudioFileInfo[]
  hasDirectories: false
  queueName: string
  startIndex: number
  playlistPath: string
  playlistName: string
}

export type LaunchPayload = EmptyLaunchPayload | PlaybackLaunchPayload | PlaylistImportLaunchPayload

export type LaunchPayloadSummary = {
  kind: LaunchPayloadKind
  files: number
  directories: number
  songs: number
  queueName: string
  playlistPath: string | null
}

export type LaunchToastNotification = {
  type: 'toast'
  variant: 'success' | 'error'
  message: string
}

export type LaunchNotification = string | LaunchToastNotification

export type NotifyLaunchRenderer = (message: LaunchNotification) => void

export type InvalidateDirectoryCache = (dirPath?: string | null) => void

export type LaunchProcessingOptions = {
  notifyRenderer?: NotifyLaunchRenderer
  invalidateDirectoryCache?: InvalidateDirectoryCache
}

export type ProcessLaunchArgsOptions = LaunchProcessingOptions & {
  workingDirectory?: string
}

export type ProcessAndDispatchLaunchArgsOptions = ProcessLaunchArgsOptions & {
  mainWindow?: BrowserWindow | null
  batchWindowMs?: number
}

export type LaunchDispatchRequest = {
  entries: LaunchEntry[]
  notifyRenderer: NotifyLaunchRenderer
  invalidateDirectoryCache: InvalidateDirectoryCache
}

export type DirectoryImportSuccess = {
  success: true
  message: string
  count: number
  directories: string[]
  songs: AudioFileInfo[]
  alreadyImported?: boolean
}

export type DirectoryImportFailure = {
  success: false
  message: string
  songs?: never
}

export type DirectoryImportResult = DirectoryImportSuccess | DirectoryImportFailure

export type ArgvIpcContract = {
  'get-argv-files': {
    args: []
    result: LaunchPayload[]
  }
  'process-dropped-paths': {
    args: [droppedPaths?: string[]]
    result: LaunchPayload
  }
}

export type ArgvChannel = keyof ArgvIpcContract

export type ArgvArgs<C extends ArgvChannel> = ArgvIpcContract[C]['args']

export type ArgvResult<C extends ArgvChannel> = ArgvIpcContract[C]['result']

export type ArgvInvokeHandler<C extends ArgvChannel> = (
  event: IpcMainInvokeEvent,
  ...args: ArgvArgs<C>
) => MaybePromise<ArgvResult<C>>
