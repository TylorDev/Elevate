import chokidar from 'chokidar'
import path from 'path'
import { prisma } from '../../prisma.mjs'
import { getOrCreateSong } from './utils.mjs'
import { updateDirectoryStats, directoryHasAudio } from './directoryScanner.mjs'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg'])
const DEBOUNCE_MS = 500

/** @type {Map<string, import('chokidar').FSWatcher>} */
const watchers = new Map()

/** @type {Map<string, { added: Set<string>, removed: Set<string> }>} */
const pendingChanges = new Map()

let debounceTimer = null
let notifyRenderer = null

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
export function startWatching(dirPath) {
  if (watchers.has(dirPath)) return

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
      startWatching(dir.path)
    }

    console.debug(`[watcher] Initialized ${directories.length} root watchers`)
  } catch (error) {
    console.error('[watcher] Error initializing watchers:', error)
  }
}

// ─── Event handlers ──────────────────────────────────────────────────

function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
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
      const hasAudio = await directoryHasAudio(newDirPath)
      if (!hasAudio) return

      // Check if it's already registered
      const existing = await prisma.directory.findUnique({ where: { path: newDirPath } })
      if (existing) return

      // Find the parent directory in DB
      const parent = await prisma.directory.findFirst({
        where: { path: path.dirname(newDirPath) }
      })

      await prisma.directory.create({
        data: {
          path: newDirPath,
          parentId: parent?.id || null
        }
      })

      // Index the new subdirectory
      const { updateDirectoryStats: updateStats } = await import('./directoryScanner.mjs')
      await updateStats(newDirPath)

      console.debug(`[watcher] Registered new subdirectory: ${newDirPath}`)
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
        const fileName = path.basename(filePath, path.extname(filePath))
        await getOrCreateSong(filePath, fileName).catch((err) => {
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
