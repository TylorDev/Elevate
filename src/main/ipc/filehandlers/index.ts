// @ts-nocheck
import { dialog, ipcMain } from 'electron'
import fs from 'fs'
import log from 'electron-log/main.js'
import {
  getAudioCover,
  getAudioFilesPage,
  getUniqueAudioPaths,
  clearAudioCaches
} from './audioLibrary.ts'
import {
  clearPendingDirectoriesRequest,
  deleteDirectory,
  deleteDirectoryBranch,
  getAllDirectories,
  getAudioInDirectory,
  getDirectoriesNumber,
  getRandomDirectory,
  searchDirectoriesPage
} from './directories.ts'
import {
  getCollectionOverview,
  getCollectionTracksPage
} from './collections.ts'
import {
  getFeedCollectionCover,
  getFeedCollectionRankings,
  invalidateFeedCollectionsCache,
  refreshFeedCollectionRankings
} from './feed.ts'
import {
  openDirectoryInExplorer,
  revealPathInExplorer
} from './explorer.ts'
import { sendNotification } from '../../index.ts'
import { prisma } from '../../prisma.ts'
import { getStoragePaths } from '../../storagePaths.ts'
import { setBraveVolume } from '../audio.ts'
import { addDirectoryToLibrary } from '../utils/libraryIngestion.ts'
import { setNotifyRenderer } from '../utils/directoryWatcher.ts'
import { getFileInfos } from '../utils/utils.ts'
import { getPlaylistEditPayload } from '../playlistHandlers/index.ts'

export function invalidateDirectoryCache(dirPath = null) {
  clearPendingDirectoriesRequest()
  invalidateFeedCollectionsCache('all')
  clearAudioCaches(dirPath)
}

function setupSignalFileWatcher() {
  const signalFilePath = getStoragePaths().signalFilePath
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
}

export function setupFilehandlers() {
  setNotifyRenderer((message) => sendNotification(message))
  setupSignalFileWatcher()

  ipcMain.handle('add-directory', async (_, providedPath = null) => {
    try {
      let selectedPath = providedPath

      if (!selectedPath) {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory']
        })

        if (result.canceled) {
          return null
        }

        selectedPath = result.filePaths[0]
      }

      return await addDirectoryToLibrary(selectedPath, {
        notifyRenderer: sendNotification,
        invalidateDirectoryCache
      })
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('get-new-audio-files', async () => {
    try {
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
      return getAudioInDirectory(directoryPath)
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  ipcMain.handle('collection:get-overview', async (_, request) => {
    try {
      return await getCollectionOverview(request)
    } catch (error) {
      console.error('Error retrieving collection overview:', error)
      return { success: false, error: error.message || 'Could not load the collection.' }
    }
  })

  ipcMain.handle('collection:get-tracks-page', async (_, request) => {
    try {
      return await getCollectionTracksPage(request)
    } catch (error) {
      console.error('Error retrieving collection tracks page:', error)
      return { success: false, error: error.message || 'Could not load songs.' }
    }
  })

  ipcMain.handle('collection:get-playlist-edit-payload', async (_, playlistPath) => {
    try {
      return await getPlaylistEditPayload(playlistPath)
    } catch (error) {
      console.error('Error retrieving playlist edit payload:', error)
      return { success: false, error: error.message || 'No se pudo cargar la playlist.' }
    }
  })

  ipcMain.handle('feed:get-collection-rankings', async (_, request) => {
    try {
      return await getFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error retrieving feed collection rankings:', error)
      return { success: false, error: error.message || 'No se pudo cargar el feed.' }
    }
  })

  ipcMain.handle('feed:refresh-collection-rankings', async (_, request) => {
    try {
      return await refreshFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error refreshing feed collection rankings:', error)
      return { success: false, error: error.message || 'No se pudo actualizar el feed.' }
    }
  })

  ipcMain.handle('feed:get-collection-cover', async (_, request) => {
    try {
      return await getFeedCollectionCover(request)
    } catch (error) {
      console.error('Error retrieving feed collection cover:', error)
      return null
    }
  })

  ipcMain.handle('delete-directory', async (event, dirPath) => {
    return deleteDirectory(dirPath, { invalidateDirectoryCache })
  })

  ipcMain.handle('delete-directory-branch', async (event, request) => {
    return deleteDirectoryBranch(request, { invalidateDirectoryCache })
  })

  ipcMain.handle('get-all-directories', async () => {
    try {
      return await getAllDirectories()
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })

  ipcMain.handle('get-directories-number', async () => {
    try {
      return await getDirectoriesNumber()
    } catch (error) {
      console.error('Error retrieving directories count:', error)
      throw error
    }
  })

  ipcMain.handle('get-random-directory', async () => {
    return await getRandomDirectory()
  })

  ipcMain.handle('search-directories-page', async (event, request) => {
    return searchDirectoriesPage(request)
  })

  ipcMain.handle('reveal-path-in-explorer', async (_, targetPath) => {
    return revealPathInExplorer(targetPath)
  })

  ipcMain.handle('open-directory-in-explorer', async (_, targetPath) => {
    return openDirectoryInExplorer(targetPath)
  })
}
