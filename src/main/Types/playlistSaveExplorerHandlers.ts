import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'

export type PlaylistSaveDirectoryEntry = {
  name: string
  path: string
  type: 'directory'
}

export type PlaylistSaveFileEntry = {
  name: string
  path: string
  type: 'file'
}

export type PlaylistSaveDirectoryResult = {
  path: string
}

export type PlaylistSaveDirectorySnapshot = {
  currentPath: string
  parentPath: string | null
  directories: PlaylistSaveDirectoryEntry[]
  files: PlaylistSaveFileEntry[]
}

export type PlaylistSaveExplorerIpcContract = {
  'get-playlist-save-directory': {
    args: [sourcePath?: string | null]
    result: PlaylistSaveDirectoryResult
  }
  'list-playlist-save-directory': {
    args: [directoryPath?: string | null]
    result: PlaylistSaveDirectorySnapshot
  }
}

export type PlaylistSaveExplorerChannel = IpcChannel<PlaylistSaveExplorerIpcContract>

export type PlaylistSaveExplorerArgs<C extends PlaylistSaveExplorerChannel> = IpcArgs<
  PlaylistSaveExplorerIpcContract,
  C
>

export type PlaylistSaveExplorerInvokeHandler<C extends PlaylistSaveExplorerChannel> =
  IpcInvokeHandler<PlaylistSaveExplorerArgs<C>, PlaylistSaveExplorerIpcContract[C]['result']>
