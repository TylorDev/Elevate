import path from 'path'
import { prisma } from '../../prisma.mjs'
import { getOrCreateSong } from './utils.mjs'
import { updateDirectoryStats, discoverSubdirectories } from './directoryScanner.mjs'
import { isSupportedMediaFile, resolveImportableAudioPath } from './mediaFileSupport.mjs'

const DEBOUNCE_MS = 500

/** @type {Map<string, import('chokidar').FSWatcher>} */
const watchers = new Map()

/** @type {Map<string, { added: Set<string>, removed: Set<string> }>} */
const pendingChanges = new Map()

let debounceTimer = null
let notifyRenderer = null
let chokidarModulePromise = null

async function getChokidar() {
  if (!chokidarModulePromise) {
    chokidarModulePromise = import('chokidar').then((module) => module.default || module)
  }

  return chokidarModulePromise
}

function uniquePaths(paths) {
  return [...new Set(paths.map((currentPath) => path.normalize(currentPath)))]
}

function getPathDepth(dirPath) {
  return path
    .normalize(dirPath)
    .split(path.sep)
    .filter(Boolean).length
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Set the function used to notify the renderer of directory changes.
 * Typically: (message) => mainWindow.webContents.send('notification', message)
 */
export function setNotifyRenderer(fn) {
  notifyRenderer = fn
}

/**
 * Set the function used to send scan progress to the renderer.
 */
let sendProgressFn = null
export function setSendProgress(fn) {
  sendProgressFn = fn
}

/**
 * Start watching a directory recursively.
 * Idempotent — calling with an already-watched path is a no-op.
 */
export async function startWatching(dirPath) {
  if (watchers.has(dirPath)) return

  const chokidar = await getChokidar()
  const watcher = chokidar.watch(dirPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200
    },
    depth: Infinity,
    ignored: /(^|[/\\])\./
  })

  watcher.on('add', (filePath) => onFileAdded(filePath, dirPath))
  watcher.on('unlink', (filePath) => onFileRemoved(filePath, dirPath))
  watcher.on('addDir', (newDirPath) => onDirAdded(newDirPath, dirPath))
  watcher.on('unlinkDir', (removedDirPath) => onDirRemoved(removedDirPath, dirPath))
  watcher.on('error', (error) => console.error(`Watcher error for ${dirPath}:`, error.message))

  watchers.set(dirPath, watcher)
  console.debug(`[watcher] Watching: ${dirPath}`)
}

/**
 * Stop watching a specific directory.
 */
export async function stopWatching(dirPath) {
  const watcher = watchers.get(dirPath)
  if (watcher) {
    await watcher.close()
    watchers.delete(dirPath)
    console.debug(`[watcher] Stopped watching: ${dirPath}`)
  }
}

/**
 * Stop all watchers (for app shutdown).
 */
export async function stopAll() {
  const closePromises = []
  for (const [dirPath, watcher] of watchers) {
    closePromises.push(watcher.close())
    console.debug(`[watcher] Stopping: ${dirPath}`)
  }
  await Promise.all(closePromises)
  watchers.clear()
}

/**
 * Initialize watchers for all directories currently in the DB.
 */
export async function initializeWatchers() {
  try {
    const directories = await prisma.directory.findMany({
      where: { parentId: null },
      select: { path: true }
    })

    for (const dir of directories) {
      await startWatching(dir.path)
    }

    console.debug(`[watcher] Initialized ${directories.length} root watchers`)
  } catch (error) {
    console.error('[watcher] Error initializing watchers:', error)
  }
}

// ─── Event handlers ──────────────────────────────────────────────────

function isAudioFile(filePath) {
  return isSupportedMediaFile(filePath)
}

function findOwnerDir(filePath, rootDirPath) {
  // Find the immediate parent directory of the file
  return path.dirname(filePath)
}

function onFileAdded(filePath, rootDirPath) {
  if (!isAudioFile(filePath)) return
  const ownerDir = findOwnerDir(filePath, rootDirPath)
  queueChange('added', filePath, ownerDir, rootDirPath)
}

function onFileRemoved(filePath, rootDirPath) {
  if (!isAudioFile(filePath)) return
  const ownerDir = findOwnerDir(filePath, rootDirPath)
  queueChange('removed', filePath, ownerDir, rootDirPath)
}

async function onDirAdded(newDirPath, rootDirPath) {
  // Check if the new directory contains audio after a short delay
  // (files may still be copying)
  setTimeout(async () => {
    try {
      const discoveredDirectories = uniquePaths(await discoverSubdirectories(newDirPath))
      const directoriesToRegister = uniquePaths([newDirPath, ...discoveredDirectories]).sort(
        (leftPath, rightPath) => {
          const depthDifference = getPathDepth(leftPath) - getPathDepth(rightPath)

          if (depthDifference !== 0) {
            return depthDifference
          }

          return leftPath.localeCompare(rightPath)
        }
      )

      if (discoveredDirectories.length === 0) return

      for (const dirPath of directoriesToRegister) {
        const parent = await prisma.directory.findFirst({
          where: { path: path.dirname(dirPath) }
        })

        await prisma.directory.upsert({
          where: { path: dirPath },
          update: {
            parentId: parent?.id || null
          },
          create: {
            path: dirPath,
            parentId: parent?.id || null
          }
        })

        await updateDirectoryStats(dirPath)
      }

      console.debug(`[watcher] Registered directory tree: ${newDirPath}`)
      notifyRenderer?.('[directory-changed]')
    } catch (error) {
      console.error(`[watcher] Error handling new directory ${newDirPath}:`, error.message)
    }
  }, 2000)
}

async function onDirRemoved(removedDirPath, rootDirPath) {
  try {
    // Delete the directory and its children (cascade) from DB
    const directory = await prisma.directory.findUnique({ where: { path: removedDirPath } })
    if (directory) {
      await prisma.directory.delete({ where: { path: removedDirPath } })
      console.debug(`[watcher] Removed directory: ${removedDirPath}`)
      notifyRenderer?.('[directory-changed]')
    }
  } catch (error) {
    // Ignore if it doesn't exist
    if (!error.message?.includes('Record to delete does not exist')) {
      console.error(`[watcher] Error removing directory ${removedDirPath}:`, error.message)
    }
  }
}

// ─── Debounced batch processing ──────────────────────────────────────

function queueChange(type, filePath, ownerDir, rootDirPath) {
  const key = ownerDir
  if (!pendingChanges.has(key)) {
    pendingChanges.set(key, { added: new Set(), removed: new Set(), rootDirPath })
  }
  const changes = pendingChanges.get(key)

  if (type === 'added') {
    changes.removed.delete(filePath) // Cancel out remove+add (rename)
    changes.added.add(filePath)
  } else {
    changes.added.delete(filePath) // Cancel out add+remove
    changes.removed.add(filePath)
  }

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => flushChanges(), DEBOUNCE_MS)
}

async function flushChanges() {
  const snapshot = new Map(pendingChanges)
  pendingChanges.clear()

  for (const [ownerDir, changes] of snapshot) {
    try {
      // Process additions — index new songs
      for (const filePath of changes.added) {
        const importablePath = await resolveImportableAudioPath(filePath)
        const fileName = path.basename(importablePath, path.extname(importablePath))
        await getOrCreateSong(importablePath, fileName).catch((err) => {
          console.error(`[watcher] Error indexing ${filePath}:`, err.message)
        })
      }

      // Process removals — no song deletion needed (songs persist),
      // but we update the directory stats
      if (changes.removed.size > 0) {
        console.debug(
          `[watcher] ${changes.removed.size} files removed from ${ownerDir}`
        )
      }

      // Update stats for affected directories
      const affectedDirs = new Set()
      affectedDirs.add(ownerDir)

      // Also update the root directory if different
      if (changes.rootDirPath && changes.rootDirPath !== ownerDir) {
        affectedDirs.add(changes.rootDirPath)
      }

      for (const dirPath of affectedDirs) {
        const dirRecord = await prisma.directory.findUnique({ where: { path: dirPath } })
        if (dirRecord) {
          await updateDirectoryStats(dirPath)
        }
      }

      notifyRenderer?.('[directory-changed]')
    } catch (error) {
      console.error(`[watcher] Error flushing changes for ${ownerDir}:`, error.message)
    }
  }
}
