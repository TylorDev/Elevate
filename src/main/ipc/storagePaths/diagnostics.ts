import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { getStoragePaths } from './paths.ts'
import type {
  BuildPathInfoOptions,
  StorageDiagnostics,
  StoragePathInfo
} from '../../Types/storagePaths.ts'

export function buildPathInfo(
  targetPath: string,
  { fallbackWritableTarget = null }: BuildPathInfoOptions = {}
): StoragePathInfo {
  const info: StoragePathInfo = {
    path: targetPath,
    exists: false,
    kind: 'missing',
    size: null,
    isWritable: false
  }

  if (!targetPath) return info

  try {
    if (existsSync(targetPath)) {
      const stats = statSync(targetPath)
      info.exists = true
      info.kind = stats.isDirectory() ? 'directory' : 'file'
      info.size = stats.isFile() ? stats.size : null
      accessSync(targetPath, constants.W_OK)
      info.isWritable = true
      return info
    }

    accessSync(fallbackWritableTarget || dirname(targetPath), constants.W_OK)
    info.isWritable = true
  } catch {
    info.isWritable = false
  }

  return info
}

export function getStorageDiagnostics(): StorageDiagnostics {
  const paths = getStoragePaths()

  return {
    runtimeMode: paths.runtimeMode,
    isPackaged: paths.isPackaged,
    usesPortableOverride: paths.usesPortableOverride,
    paths: {
      userDataRoot: buildPathInfo(paths.userDataRoot),
      resourcesRoot: buildPathInfo(paths.resourcesRoot),
      executableDir: buildPathInfo(paths.executableDir),
      executablePath: buildPathInfo(paths.executablePath),
      appAsarPath: buildPathInfo(paths.appAsarPath),
      databasePath: buildPathInfo(paths.databasePath, {
        fallbackWritableTarget: dirname(paths.databasePath)
      }),
      databaseWalPath: buildPathInfo(paths.databaseWalPath, {
        fallbackWritableTarget: dirname(paths.databaseWalPath)
      }),
      databaseShmPath: buildPathInfo(paths.databaseShmPath, {
        fallbackWritableTarget: dirname(paths.databaseShmPath)
      }),
      templateDatabasePath: buildPathInfo(paths.templateDatabasePath || ''),
      coverCacheRoot: buildPathInfo(paths.coverCacheRoot, {
        fallbackWritableTarget: dirname(paths.coverCacheRoot)
      }),
      feedCacheRoot: buildPathInfo(paths.feedCacheRoot, {
        fallbackWritableTarget: dirname(paths.feedCacheRoot)
      }),
      convertedAudioRoot: buildPathInfo(paths.convertedAudioRoot, {
        fallbackWritableTarget: dirname(paths.convertedAudioRoot)
      }),
      backgroundImagesRoot: buildPathInfo(paths.backgroundImagesRoot, {
        fallbackWritableTarget: dirname(paths.backgroundImagesRoot)
      }),
      windowStatePath: buildPathInfo(paths.windowStatePath, {
        fallbackWritableTarget: dirname(paths.windowStatePath)
      }),
      logsRoot: buildPathInfo(paths.logsRoot, { fallbackWritableTarget: dirname(paths.logsRoot) }),
      updaterCacheRoot: buildPathInfo(paths.updaterCacheRoot, {
        fallbackWritableTarget: dirname(paths.updaterCacheRoot)
      })
    },
    templateDatabaseCandidates: paths.templateDatabaseCandidates
  }
}
