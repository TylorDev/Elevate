import { createRequire } from 'node:module'
import log from 'electron-log/main.js'
import {
  extractAudioCover,
  getFileInfos,
  getAllAudioFiles,
  getOrCreateSong,
  resizeCover,
  getTotalDuration
} from './utils/utils.mjs'

import fs from 'fs'
import path from 'path'
import { sendNotification } from '../index.mjs'
import { prisma } from '../prisma.mjs'
import { setBraveVolume } from './audio.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, dialog, ipcMain } = electron
const watchedDirectories = new Set()
const directoryDetailsCache = new Map()
const audioPathsCache = new Map()
const audioCoverCache = new Map()
const DIRECTORY_DETAILS_TTL = 60 * 1000
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400
let pendingDirectoriesRequest = null

function invalidateDirectoryCache(dirPath = null) {
  pendingDirectoriesRequest = null

  if (!dirPath) {
    directoryDetailsCache.clear()
    audioPathsCache.clear()
    audioCoverCache.clear()
    return
  }

  directoryDetailsCache.delete(dirPath)
  audioPathsCache.delete(dirPath)
  for (const key of audioCoverCache.keys()) {
    if (key.startsWith(`${dirPath}:`) || key.includes(`:${dirPath}:`)) {
      audioCoverCache.delete(key)
    }
  }
}

function getCachedAudioFiles(dirPath) {
  const cachedFiles = audioPathsCache.get(dirPath)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  const files = getAllAudioFiles(dirPath)
  audioPathsCache.set(dirPath, {
    files,
    expiresAt: Date.now() + AUDIO_PATHS_TTL
  })

  return files
}

async function getUniqueAudioPaths() {
  const directories = await prisma.directory.findMany()

  if (!directories.length) return []

  const allAudioFiles = directories.flatMap((dir) => getCachedAudioFiles(dir.path))
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

  const cover = await extractAudioCover(filePath)

  if (!cover) {
    audioCoverCache.set(cacheKey, {
      cover: null,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    while (audioCoverCache.size > COVER_CACHE_LIMIT) {
      const oldestKey = audioCoverCache.keys().next().value
      audioCoverCache.delete(oldestKey)
    }
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

async function getDirectoryDetails(directory) {
  const cachedDetails = directoryDetailsCache.get(directory.path)

  if (cachedDetails && cachedDetails.expiresAt > Date.now()) {
    return {
      ...directory,
      ...cachedDetails.details
    }
  }

  const details = await getTotalDuration(directory.path)
  directoryDetailsCache.set(directory.path, {
    details,
    expiresAt: Date.now() + DIRECTORY_DETAILS_TTL
  })

  return {
    ...directory,
    ...details
  }
}

async function getDirectoriesWithDetails() {
  if (pendingDirectoriesRequest) {
    return pendingDirectoriesRequest
  }

  pendingDirectoriesRequest = prisma.directory
    .findMany()
    .then((directories) => Promise.all(directories.map((directory) => getDirectoryDetails(directory))))
    .finally(() => {
      pendingDirectoriesRequest = null
    })

  return pendingDirectoriesRequest
}

async function startWatchingDirectories() {
  try {
    console.log('Starting')
    const directories = await prisma.directory.findMany()

    directories.forEach(({ path }) => {
      watchDirectory(path)
    })
  } catch (error) {
    console.error('Error al obtener los directorios:', error)
  }
}

function watchDirectory(dirPath) {
  if (watchedDirectories.has(dirPath)) {
    console.debug(`El directorio ${dirPath} ya está siendo vigilado.`)
    return
  }

  try {
    fs.watch(dirPath, (eventType, filename) => handleFileChange(eventType, filename, dirPath))
    watchedDirectories.add(dirPath)
    console.debug(`Vigilando el directorio: ${dirPath}`)
  } catch (error) {
    console.error(`Error al intentar vigilar el directorio ${dirPath}:`, error)
  }
}

function handleFileChange(eventType, filename, dirPath) {
  if (eventType !== 'rename' || !filename) return

  const fullPath = buildFullPath(filename, dirPath)
  if (isFile(fullPath)) {
    invalidateDirectoryCache(dirPath)
    const basenameWithoutExt = extractBasename(filename)
    getOrCreateSong(fullPath, basenameWithoutExt)
    debugFileDetails(fullPath, basenameWithoutExt)
  }
}

function buildFullPath(filename, dirPath) {
  return path.join(dirPath, filename)
}

function isFile(fullPath) {
  return fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()
}

function extractBasename(filename) {
  return path.parse(filename).name
}

function debugFileDetails(fullPath, basenameWithoutExt) {
  sendNotification(`[new]`)
  console.debug(`Archivo detectado:`)
  console.debug(`Ruta completa: ${fullPath}`)
  console.debug(`Basename sin extensión: ${basenameWithoutExt}`)
}

export function setupFilehandlers() {
  startWatchingDirectories()
  const signalFilePath =
    process.env.ELEVATE_SIGNAL_FILE || path.join(app.getPath('userData'), 'signal.txt')
  if (fs.existsSync(signalFilePath)) {
    log.info('File exists, starting watch:', signalFilePath)

    // Vigilar el archivo
    fs.watch(signalFilePath, (eventType, filename) => {
      if (filename) {
        // Leer el contenido del archivo
        fs.readFile(signalFilePath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error al leer el archivo: ${err}`)
            return
          }

          // Eliminar el BOM si está presente
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

  ipcMain.handle('add-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null // O manejar la cancelación según sea necesario
      }
      const directoryPath = result.filePaths[0]

      // Upsert en Prisma para agregar o actualizar el directorio
      await prisma.directory.upsert({
        where: { path: directoryPath },
        update: {},
        create: { path: directoryPath }
      })
      invalidateDirectoryCache()

      return { success: true, message: 'Directory added sucessfully.' }
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
      const audioFiles = getCachedAudioFiles(directoryPath)

      // Filtrar archivos duplicados
      const uniqueAudioFiles = Array.from(new Set(audioFiles))

      return getFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  ipcMain.handle('delete-directory', async (event, path) => {
    try {
      // Eliminar el directorio por su ruta
      await prisma.directory.delete({
        where: { path: path }
      })
      invalidateDirectoryCache(path)
      return { success: true, message: 'Directory deleted successfully.' }
    } catch (error) {
      console.error('Error deleting directory:', error)
      return { success: false, message: 'Error deleting directory.' }
    }
  })

  ipcMain.handle('get-directory-by-path', async (event, path) => {
    try {
      // Obtener el directorio con un path específico
      const directory = await prisma.directory.findUnique({
        where: { path }
      })

      if (!directory) {
        throw new Error('Directory not found')
      }

      // Obtener las propiedades totalTracks y totalDuration
      return await getDirectoryDetails(directory)
    } catch (error) {
      console.error('Error retrieving directory:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-directories', async () => {
    try {
      return await getDirectoriesWithDetails()
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })
}
