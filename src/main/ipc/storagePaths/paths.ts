import { dirname, join, resolve } from 'node:path'
import { app } from 'electron'
import {
  findTemplateDatabasePath,
  getDatabasePath,
  getTemplateDatabaseCandidates
} from './database.ts'
import {
  getPortableOverrideRoot,
  getResolvedUserDataRoot,
  getRuntimeMode,
  getUpdaterCachePath,
  UPDATER_CACHE_DIR_NAME
} from './runtime.ts'
import type { StoragePaths } from '../../Types/storagePaths.ts'

export function getStoragePaths(): StoragePaths {
  const userDataRoot = getResolvedUserDataRoot()
  const resourcesRoot = process.resourcesPath || join(app.getAppPath(), 'resources')
  const databasePath = getDatabasePath()
  const templateDatabasePath = findTemplateDatabasePath()
  const executablePath = app.getPath('exe')
  const executableDir = dirname(executablePath)
  const coverCacheRoot = app.isPackaged ? join(userDataRoot, 'covers') : resolve('covers')
  const feedCacheRoot = join(userDataRoot, 'feed-cache-v1')
  const convertedAudioRoot = join(userDataRoot, 'converted-audio')
  const backgroundImagesRoot = join(userDataRoot, 'background-images')
  const backgroundAssetsRoot = join(backgroundImagesRoot, 'assets')

  return {
    runtimeMode: getRuntimeMode(),
    isPackaged: app.isPackaged,
    usesPortableOverride: Boolean(getPortableOverrideRoot()),
    userDataRoot,
    resourcesRoot,
    executablePath,
    executableDir,
    appAsarPath: join(resourcesRoot, 'app.asar'),
    databasePath,
    databaseWalPath: `${databasePath}-wal`,
    databaseShmPath: `${databasePath}-shm`,
    templateDatabasePath,
    templateDatabaseCandidates: getTemplateDatabaseCandidates(),
    coverCacheRoot,
    coverThumbRoot: join(coverCacheRoot, 'thumb'),
    coverFullRoot: join(coverCacheRoot, 'full'),
    playlistCoverThumbRoot: join(coverCacheRoot, 'playlist-thumb'),
    playlistCoverFullRoot: join(coverCacheRoot, 'playlist-full'),
    feedCacheRoot,
    feedCoverCacheRoot: join(feedCacheRoot, 'covers'),
    convertedAudioRoot,
    backgroundImagesRoot,
    backgroundAssetsRoot,
    backgroundConfigPath: join(backgroundImagesRoot, 'background-config.json'),
    windowStatePath: join(userDataRoot, 'window-state.json'),
    logsRoot: app.getPath('logs'),
    updaterCacheDirName: UPDATER_CACHE_DIR_NAME,
    updaterCacheRoot: getUpdaterCachePath()
  }
}
