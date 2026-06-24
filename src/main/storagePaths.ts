// @ts-nocheck
import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { app } = require('electron')
const __dirname = dirname(fileURLToPath(import.meta.url))
const UPDATER_CACHE_DIR_NAME = 'elevate-updater'

function canUsePortableOverride() {
  return process.env.ELEVATE_ENABLE_PORTABLE_MODE === '1' || !app.isPackaged
}

function getPortableOverrideRoot() {
  const rawValue = process.env.ELEVATE_PORTABLE_DATA_DIR

  if (!rawValue || !canUsePortableOverride()) {
    return null
  }

  return resolve(rawValue)
}

function getResolvedUserDataRoot() {
  return getPortableOverrideRoot() || app.getPath('userData')
}

function getDatabasePath() {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return resolve(process.env.DATABASE_URL.replace(/^file:/, ''))
  }

  if (!app.isPackaged) {
    return resolve('prisma/dev.db')
  }

  return join(getResolvedUserDataRoot(), 'elevate.db')
}

function getTemplateDatabaseCandidates() {
  return [
    resolve('prisma/template.db'),
    join(app.getAppPath(), 'prisma/template.db'),
    join(process.resourcesPath || '', 'prisma/template.db'),
    join(__dirname, '../../prisma/template.db')
  ]
}

function findTemplateDatabasePath() {
  return getTemplateDatabaseCandidates().find((candidate) => existsSync(candidate)) || null
}

function getUpdaterCachePath() {
  const localAppData =
    process.env.LOCALAPPDATA ||
    join(dirname(app.getPath('appData')), 'Local')

  return join(localAppData, UPDATER_CACHE_DIR_NAME)
}

function buildPathInfo(targetPath, { fallbackWritableTarget = null } = {}) {
  const info = {
    path: targetPath,
    exists: false,
    kind: 'missing',
    size: null,
    isWritable: false
  }

  if (!targetPath) {
    return info
  }

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

    const writableTarget = fallbackWritableTarget || dirname(targetPath)
    accessSync(writableTarget, constants.W_OK)
    info.isWritable = true
  } catch {
    info.isWritable = false
  }

  return info
}

export function getStoragePaths() {
  const userDataRoot = getResolvedUserDataRoot()
  const resourcesRoot = process.resourcesPath || join(app.getAppPath(), 'resources')
  const databasePath = getDatabasePath()
  const databaseDir = dirname(databasePath)
  const templateDatabasePath = findTemplateDatabasePath()
  const executablePath = app.getPath('exe')
  const executableDir = dirname(executablePath)
  const coverCacheRoot = app.isPackaged
    ? join(userDataRoot, 'covers')
    : resolve('covers')
  const feedCacheRoot = join(userDataRoot, 'feed-cache-v1')
  const convertedAudioRoot = join(userDataRoot, 'converted-audio')
  const backgroundImagesRoot = join(userDataRoot, 'background-images')
  const backgroundAssetsRoot = join(backgroundImagesRoot, 'assets')
  const windowStatePath = join(userDataRoot, 'window-state.json')
  const signalFilePath = process.env.ELEVATE_SIGNAL_FILE || join(userDataRoot, 'signal.txt')
  const logsRoot = app.getPath('logs')
  const updaterCacheRoot = getUpdaterCachePath()

  return {
    runtimeMode: !app.isPackaged
      ? 'development'
      : getPortableOverrideRoot()
        ? 'portable-debug-override'
        : 'installed-release',
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
    windowStatePath,
    signalFilePath,
    logsRoot,
    updaterCacheDirName: UPDATER_CACHE_DIR_NAME,
    updaterCacheRoot
  }
}

export function getStorageDiagnostics() {
  const storagePaths = getStoragePaths()

  return {
    runtimeMode: storagePaths.runtimeMode,
    isPackaged: storagePaths.isPackaged,
    usesPortableOverride: storagePaths.usesPortableOverride,
    paths: {
      userDataRoot: buildPathInfo(storagePaths.userDataRoot),
      resourcesRoot: buildPathInfo(storagePaths.resourcesRoot),
      executableDir: buildPathInfo(storagePaths.executableDir),
      executablePath: buildPathInfo(storagePaths.executablePath),
      appAsarPath: buildPathInfo(storagePaths.appAsarPath),
      databasePath: buildPathInfo(storagePaths.databasePath, {
        fallbackWritableTarget: dirname(storagePaths.databasePath)
      }),
      databaseWalPath: buildPathInfo(storagePaths.databaseWalPath, {
        fallbackWritableTarget: dirname(storagePaths.databaseWalPath)
      }),
      databaseShmPath: buildPathInfo(storagePaths.databaseShmPath, {
        fallbackWritableTarget: dirname(storagePaths.databaseShmPath)
      }),
      templateDatabasePath: buildPathInfo(storagePaths.templateDatabasePath || ''),
      coverCacheRoot: buildPathInfo(storagePaths.coverCacheRoot, {
        fallbackWritableTarget: dirname(storagePaths.coverCacheRoot)
      }),
      feedCacheRoot: buildPathInfo(storagePaths.feedCacheRoot, {
        fallbackWritableTarget: dirname(storagePaths.feedCacheRoot)
      }),
      convertedAudioRoot: buildPathInfo(storagePaths.convertedAudioRoot, {
        fallbackWritableTarget: dirname(storagePaths.convertedAudioRoot)
      }),
      backgroundImagesRoot: buildPathInfo(storagePaths.backgroundImagesRoot, {
        fallbackWritableTarget: dirname(storagePaths.backgroundImagesRoot)
      }),
      windowStatePath: buildPathInfo(storagePaths.windowStatePath, {
        fallbackWritableTarget: dirname(storagePaths.windowStatePath)
      }),
      signalFilePath: buildPathInfo(storagePaths.signalFilePath, {
        fallbackWritableTarget: dirname(storagePaths.signalFilePath)
      }),
      logsRoot: buildPathInfo(storagePaths.logsRoot, {
        fallbackWritableTarget: dirname(storagePaths.logsRoot)
      }),
      updaterCacheRoot: buildPathInfo(storagePaths.updaterCacheRoot, {
        fallbackWritableTarget: dirname(storagePaths.updaterCacheRoot)
      })
    },
    templateDatabaseCandidates: storagePaths.templateDatabaseCandidates
  }
}
