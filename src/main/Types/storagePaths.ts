import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'

export type StorageRuntimeMode = 'development' | 'portable-debug-override' | 'installed-release'

export type StoragePaths = {
  runtimeMode: StorageRuntimeMode
  isPackaged: boolean
  usesPortableOverride: boolean
  userDataRoot: string
  resourcesRoot: string
  executablePath: string
  executableDir: string
  appAsarPath: string
  databasePath: string
  databaseWalPath: string
  databaseShmPath: string
  templateDatabasePath: string | null
  templateDatabaseCandidates: string[]
  coverCacheRoot: string
  coverThumbRoot: string
  coverFullRoot: string
  playlistCoverThumbRoot: string
  playlistCoverFullRoot: string
  feedCacheRoot: string
  feedCoverCacheRoot: string
  convertedAudioRoot: string
  backgroundImagesRoot: string
  backgroundAssetsRoot: string
  backgroundConfigPath: string
  windowStatePath: string
  logsRoot: string
  updaterCacheDirName: string
  updaterCacheRoot: string
}

export type StoragePathKind = 'missing' | 'directory' | 'file'

export type StoragePathInfo = {
  path: string
  exists: boolean
  kind: StoragePathKind
  size: number | null
  isWritable: boolean
}

export type StorageDiagnosticsPathName =
  | 'userDataRoot'
  | 'resourcesRoot'
  | 'executableDir'
  | 'executablePath'
  | 'appAsarPath'
  | 'databasePath'
  | 'databaseWalPath'
  | 'databaseShmPath'
  | 'templateDatabasePath'
  | 'coverCacheRoot'
  | 'feedCacheRoot'
  | 'convertedAudioRoot'
  | 'backgroundImagesRoot'
  | 'windowStatePath'
  | 'logsRoot'
  | 'updaterCacheRoot'

export type StorageDiagnostics = {
  runtimeMode: StorageRuntimeMode
  isPackaged: boolean
  usesPortableOverride: boolean
  paths: Record<StorageDiagnosticsPathName, StoragePathInfo>
  templateDatabaseCandidates: string[]
}

export type BuildPathInfoOptions = {
  fallbackWritableTarget?: string | null
}

export type StoragePathsIpcContract = {
  'app:get-storage-paths': {
    args: []
    result: StorageDiagnostics
  }
}

export type StoragePathsChannel = IpcChannel<StoragePathsIpcContract>
export type StoragePathsArgs<C extends StoragePathsChannel> = IpcArgs<StoragePathsIpcContract, C>
export type StoragePathsInvokeHandler<C extends StoragePathsChannel> = IpcInvokeHandler<
  StoragePathsArgs<C>,
  StoragePathsIpcContract[C]['result']
>
