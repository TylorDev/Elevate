import { createRequire } from 'node:module'
import log from 'electron-log/main.js'
import {
  extractAudioCover,
  getFileInfos,
  getOrCreateSong,
  resizeCover,
  getCoverFromCache
} from './utils/utils.mjs'

import {
  scanDirectoryAsync,
  discoverSubdirectories,
  indexDirectoryIncrementally,
  updateDirectoryStats
} from './utils/directoryScanner.mjs'

import {
  startWatching,
  stopWatching,
  setNotifyRenderer
} from './utils/directoryWatcher.mjs'

import fs from 'fs'
import path from 'path'
import { sendNotification } from '../index.mjs'
import { prisma } from '../prisma.mjs'
import { setBraveVolume } from './audio.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, dialog, ipcMain } = electron
const audioPathsCache = new Map()
const audioCoverCache = new Map()
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400
let pendingDirectoriesRequest = null

export function invalidateDirectoryCache(dirPath = null) {
  pendingDirectoriesRequest = null

  if (!dirPath) {
    audioPathsCache.clear()
    audioCoverCache.clear()
    return
  }

  audioPathsCache.delete(dirPath)
  for (const key of audioCoverCache.keys()) {
    if (key.startsWith(`${dirPath}:`) || key.includes(`:${dirPath}:`)) {
      audioCoverCache.delete(key)
    }
  }
}

async function getCachedAudioFiles(dirPath) {
  const cachedFiles = audioPathsCache.get(dirPath)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  // Use recursive=true here because the UI expects to see all files
  // inside the directory, even if we register subdirectories individually.
  const files = await scanDirectoryAsync(dirPath, true)
  audioPathsCache.set(dirPath, {
    files,
    expiresAt: Date.now() + AUDIO_PATHS_TTL
  })

  return files
}

async function getUniqueAudioPaths() {
  const directories = await prisma.directory.findMany()

  if (!directories.length) return []

  const allAudioFiles = []
  for (const dir of directories) {
    const files = await getCachedAudioFiles(dir.path)
    allAudioFiles.push(...files)
  }
  return [...new Set(allAudioFiles)]
}

function normalizeAudioPageRequest(request = {}) {
  if (typeof request === 'number') {
    return {
      page: Math.max(request, 1),
      pageSize: 100
    }
  }

  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 100, 1), 250)
  }
}

async function getAudioFilesPage(request) {
  const { page, pageSize } = normalizeAudioPageRequest(request)
  const uniqueAudioFiles = await getUniqueAudioPaths()
  const start = (page - 1) * pageSize
  const paginatedAudioFiles = uniqueAudioFiles.slice(start, start + pageSize)
  const items = await getFileInfos(paginatedAudioFiles, { includePicture: false })

  return {
    items,
    page,
    pageSize,
    total: uniqueAudioFiles.length,
    hasMore: start + pageSize < uniqueAudioFiles.length
  }
}

async function getAudioCover(filePath, variant = 'thumb') {
  if (!filePath) return null

  const cacheKey = `${variant}:${filePath}`
  const cachedCover = audioCoverCache.get(cacheKey)

  if (cachedCover && cachedCover.expiresAt > Date.now()) {
    audioCoverCache.delete(cacheKey)
    audioCoverCache.set(cacheKey, cachedCover)
    return cachedCover.cover
  }

  // Try disk cache first (populated during indexing)
  const diskCover = await getCoverFromCache(filePath, variant)
  if (diskCover) {
    audioCoverCache.set(cacheKey, {
      cover: diskCover,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    while (audioCoverCache.size > COVER_CACHE_LIMIT) {
      const oldestKey = audioCoverCache.keys().next().value
      audioCoverCache.delete(oldestKey)
    }
    return diskCover
  }

  // Fallback: extract from file (should be rare after first indexing)
  const cover = await extractAudioCover(filePath)

  if (!cover) {
    audioCoverCache.set(cacheKey, {
      cover: null,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    return null
  }

  const result =
    variant === 'thumb'
      ? {
          data: await resizeCover(cover.buffer, 128),
          mimeType: 'image/jpeg'
        }
      : {
          data: cover.buffer,
          mimeType: cover.format
        }

  audioCoverCache.set(cacheKey, {
    cover: result,
    expiresAt: Date.now() + COVER_CACHE_TTL
  })

  while (audioCoverCache.size > COVER_CACHE_LIMIT) {
    const oldestKey = audioCoverCache.keys().next().value
    audioCoverCache.delete(oldestKey)
  }

  return result
}

export function setupFilehandlers() {
  // Connect the watcher notification system to the renderer
  setNotifyRenderer((message) => sendNotification(message))

  // Signal file watcher (for Brave volume control)
  const signalFilePath =
    process.env.ELEVATE_SIGNAL_FILE || path.join(app.getPath('userData'), 'signal.txt')
  if (fs.existsSync(signalFilePath)) {
    log.info('File exists, starting watch:', signalFilePath)

    fs.watch(signalFilePath, (eventType, filename) => {
      if (filename) {
        fs.readFile(signalFilePath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error al leer el archivo: ${err}`)
            return
          }

          if (data.startsWith('\ufeff')) {
            data = data.slice(1)
          }

          if (data) {
            setBraveVolume(0.2)
          } else {
            setBraveVolume(1)
          }
        })
      }
    })

    log.info('Vigilando el txt:', signalFilePath)
  } else {
    log.info('Signal file not found, skipping optional watcher:', signalFilePath)
  }

  // ─── add-directory ───────────────────────────────────────────────
  // Opens native dialog, discovers sub-directories with audio,
  // registers them in DB, and kicks off background indexing.
  ipcMain.handle('add-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null
      }
      const selectedPath = result.filePaths[0]

      // Discover sub-directories that contain audio files
      const audioDirs = await discoverSubdirectories(selectedPath)

      if (audioDirs.length === 0) {
        return { success: false, message: 'No audio files found in the selected directory.' }
      }

      // Find or create the root directory entry (only if it has direct audio)
      let rootDirRecord = null
      if (audioDirs.includes(selectedPath)) {
        rootDirRecord = await prisma.directory.upsert({
          where: { path: selectedPath },
          update: {},
          create: { path: selectedPath }
        })
      }

      // Register each sub-directory with its parent relationship
      for (const dirPath of audioDirs) {
        if (dirPath === selectedPath) continue

        const parentPath = path.dirname(dirPath)
        const parentRecord = await prisma.directory.findUnique({
          where: { path: parentPath }
        })

        await prisma.directory.upsert({
          where: { path: dirPath },
          update: {},
          create: {
            path: dirPath,
            // Only assign parentId if the parent actually exists in the DB
            parentId: parentRecord?.id || rootDirRecord?.id || null
          }
        })
      }

      invalidateDirectoryCache()

      // Start watching the root directory (covers all subdirectories recursively)
      startWatching(selectedPath)

      // Background indexing — don't await, respond to renderer immediately
      const allDirsToIndex = await prisma.directory.findMany({
        where: { path: { in: audioDirs } }
      })

      setImmediate(async () => {
        for (const dir of allDirsToIndex) {
          try {
            const stats = await indexDirectoryIncrementally(dir.path, (progress) => {
              sendNotification(
                JSON.stringify({
                  type: 'scan-progress',
                  ...progress
                })
              )
            })

            await prisma.directory.update({
              where: { id: dir.id },
              data: {
                totalTracks: stats.totalTracks,
                totalDuration: stats.totalDuration,
                lastScannedAt: new Date()
              }
            })
          } catch (err) {
            console.error(`Error indexing ${dir.path}:`, err.message)
          }
        }

        // Notify renderer that indexing is complete
        sendNotification('[directory-changed]')
      })

      return { success: true, message: 'Directory added successfully.', count: audioDirs.length }
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('get-new-audio-files', async () => {
    try {
      // Obtener las últimas 5 canciones de la base de datos, ordenadas por timestamp
      const recentAudioFiles = await prisma.songs.findMany({
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          filepath: true
        },
        take: 5
      })

      const filepathsArray = recentAudioFiles.map((song) => song.filepath)
      return getFileInfos(filepathsArray, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving latest audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files', async (event, currentPage) => {
    try {
      if (currentPage) {
        const pageResult = await getAudioFilesPage(currentPage)
        return pageResult.items
      }

      const uniqueAudioFiles = await getUniqueAudioPaths()

      return getFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files-page', async (event, request) => {
    try {
      return await getAudioFilesPage(request)
    } catch (error) {
      console.error('Error retrieving paginated audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-cover-thumbnail', async (event, filePath) => {
    try {
      return await getAudioCover(filePath, 'thumb')
    } catch (error) {
      console.error('Error retrieving audio cover thumbnail:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-cover-full', async (event, filePath) => {
    try {
      return await getAudioCover(filePath, 'full')
    } catch (error) {
      console.error('Error retrieving full audio cover:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files-number', async () => {
    try {
      const uniqueAudioFiles = await getUniqueAudioPaths()

      return uniqueAudioFiles.length
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-in-directory', async (_, directoryPath) => {
    try {
      console.log('directory', directoryPath)
      const directory = await prisma.directory.findUnique({
        where: { path: directoryPath }
      })

      if (!directory) {
        return [] // El directorio no existe en la base de datos, devolver un array vacío
      }

      // Obtener todos los archivos de audio del directorio específico
      const audioFiles = await getCachedAudioFiles(directoryPath)

      // Filtrar archivos duplicados
      const uniqueAudioFiles = Array.from(new Set(audioFiles))

      return getFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  // ─── delete-directory ────────────────────────────────────────────
  ipcMain.handle('delete-directory', async (event, dirPath) => {
    try {
      // Stop watching this directory
      await stopWatching(dirPath)

      // Delete the directory (cascade deletes children via Prisma relation)
      await prisma.directory.delete({
        where: { path: dirPath }
      })
      invalidateDirectoryCache(dirPath)
      return { success: true, message: 'Directory deleted successfully.' }
    } catch (error) {
      console.error('Error deleting directory:', error)
      return { success: false, message: 'Error deleting directory.' }
    }
  })

  // ─── get-directory-by-path ───────────────────────────────────────
  // Now reads stats directly from the DB instead of recalculating.
  ipcMain.handle('get-directory-by-path', async (event, dirPath) => {
    try {
      const directory = await prisma.directory.findUnique({
        where: { path: dirPath }
      })

      if (!directory) {
        throw new Error('Directory not found')
      }

      // If never scanned, trigger a quick scan
      if (!directory.lastScannedAt) {
        const stats = await updateDirectoryStats(dirPath)
        return { ...directory, ...stats }
      }

      return directory
    } catch (error) {
      console.error('Error retrieving directory:', error)
      throw error
    }
  })

  // ─── get-all-directories ─────────────────────────────────────────
  // Reads stats from DB. Only rescans directories that have never been scanned.
  ipcMain.handle('get-all-directories', async () => {
    try {
      if (pendingDirectoriesRequest) {
        return pendingDirectoriesRequest
      }

      pendingDirectoriesRequest = (async () => {
        const directories = await prisma.directory.findMany()

        // For directories that have never been scanned, trigger an async scan sequentially
        const unscanned = directories.filter((d) => !d.lastScannedAt)
        if (unscanned.length > 0) {
          for (const dir of unscanned) {
            try {
              const stats = await updateDirectoryStats(dir.path)
              dir.totalTracks = stats.totalTracks
              dir.totalDuration = stats.totalDuration
            } catch (err) {
              console.error(`Error initial scan for ${dir.path}:`, err.message)
            }
          }
        }

        return directories
      })().finally(() => {
        pendingDirectoriesRequest = null
      })

      return pendingDirectoriesRequest
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })

  // ─── rescan-directory ────────────────────────────────────────────
  // Force a full re-scan of a specific directory.
  ipcMain.handle('rescan-directory', async (_, dirPath) => {
    try {
      const stats = await indexDirectoryIncrementally(dirPath, (progress) => {
        sendNotification(
          JSON.stringify({
            type: 'scan-progress',
            ...progress
          })
        )
      })

      await prisma.directory.updateMany({
        where: { path: dirPath },
        data: {
          totalTracks: stats.totalTracks,
          totalDuration: stats.totalDuration,
          lastScannedAt: new Date()
        }
      })

      invalidateDirectoryCache(dirPath)
      return { success: true, ...stats }
    } catch (error) {
      console.error('Error rescanning directory:', error)
      throw error
    }
  })
}
