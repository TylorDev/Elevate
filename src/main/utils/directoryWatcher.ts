// @ts-nocheck
import path from 'path'
import { getPrismaClient } from '../prisma.ts'
import { getOrCreateSong } from './utils.ts'
import { updateDirectoryStats, discoverSubdirectories } from './directoryScanner.ts'
import { isSupportedMediaFile, resolveImportableAudioPath } from './mediaFileSupport.ts'
import { beginPerformanceOperation } from '../diagnostics/performanceDiagnostics.ts'

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
  return path.normalize(dirPath).split(path.sep).filter(Boolean).length
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
 * Start watching a directory recursively.
 * Idempotent — calling with an already-watched path is a no-op.
 */
export async function startWatching(dirPath, onReady) {
  if (watchers.has(dirPath)) {
    onReady?.(null)
    return
  }

  const operation = beginPerformanceOperation('watcher.start-root', {
    always: true,
    details: { directoryPath: dirPath }
  })
  try {
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
    let settled = false
    const settle = (error = null) => {
      if (settled) return
      settled = true
      if (error) operation.end({ error })
      else operation.end()
      onReady?.(error)
    }
    watcher.once('ready', () => settle())
    watcher.on('error', (error) => {
      console.error(`Watcher error for ${dirPath}:`, error.message)
      settle(error)
    })

    watchers.set(dirPath, watcher)
    console.debug(`[watcher] Watching: ${dirPath}`)
  } catch (error) {
    operation.end({ error })
    onReady?.(error)
    throw error
  }
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
  const operation = beginPerformanceOperation('watcher.initialize-all', { always: true })
  try {
    const directories = await getPrismaClient().directory.findMany({
      where: { parentId: null },
      select: { path: true }
    })

    let readyCount = 0
    let failureCount = 0
    const handleReady = (error) => {
      readyCount += 1
      if (error) failureCount += 1
      if (readyCount === directories.length) {
        operation.end({ details: { rootCount: directories.length, failureCount } })
      }
    }

    for (const dir of directories) {
      await startWatching(dir.path, handleReady)
    }

    console.debug(`[watcher] Initialized ${directories.length} root watchers`)
    if (directories.length === 0) {
      operation.end({ details: { rootCount: 0, failureCount: 0 } })
    }
  } catch (error) {
    operation.end({ error })
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
        const parent = await getPrismaClient().directory.findFirst({
          where: { path: path.dirname(dirPath) }
        })

        await getPrismaClient().directory.upsert({
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
    const directory = await getPrismaClient().directory.findUnique({
      where: { path: removedDirPath }
    })
    if (directory) {
      await getPrismaClient().directory.delete({ where: { path: removedDirPath } })
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
  const totalAdded = [...snapshot.values()].reduce(
    (total, changes) => total + changes.added.size,
    0
  )
  const totalRemoved = [...snapshot.values()].reduce(
    (total, changes) => total + changes.removed.size,
    0
  )
  const operation = beginPerformanceOperation('watcher.flush-batch', {
    always: false,
    details: { directoryCount: snapshot.size, totalAdded, totalRemoved }
  })

  for (const [ownerDir, changes] of snapshot) {
    try {
      // Process additions — index new songs
      for (const filePath of changes.added) {
        const indexOperation = beginPerformanceOperation('watcher.index-file', {
          always: false,
          parentOperationId: operation.operationId,
          details: { filePath }
        })
        try {
          const importablePath = await resolveImportableAudioPath(filePath)
          const fileName = path.basename(importablePath, path.extname(importablePath))
          await getOrCreateSong(importablePath, fileName)
          indexOperation.end({ details: { importablePath } })
        } catch (err) {
          indexOperation.end({ error: err })
          console.error(`[watcher] Error indexing ${filePath}:`, err.message)
        }
      }

      // Process removals — no song deletion needed (songs persist),
      // but we update the directory stats
      if (changes.removed.size > 0) {
        console.debug(`[watcher] ${changes.removed.size} files removed from ${ownerDir}`)
      }

      // Update stats for affected directories
      const affectedDirs = new Set()
      affectedDirs.add(ownerDir)

      // Also update the root directory if different
      if (changes.rootDirPath && changes.rootDirPath !== ownerDir) {
        affectedDirs.add(changes.rootDirPath)
      }

      for (const dirPath of affectedDirs) {
        const dirRecord = await getPrismaClient().directory.findUnique({ where: { path: dirPath } })
        if (dirRecord) {
          await updateDirectoryStats(dirPath)
        }
      }

      notifyRenderer?.('[directory-changed]')
    } catch (error) {
      console.error(`[watcher] Error flushing changes for ${ownerDir}:`, error.message)
    }
  }
  operation.end()
}
