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
import { getErrorMessage } from './shared.ts'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  FilehandlerArgs,
  FilehandlerChannel,
  FilehandlerInvokeHandler
} from '../../Types/filehandlers.ts'

export type * from '../../Types/filehandlers.ts'

const db = prisma as unknown as PrismaClient
const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>
const registerNotifyRenderer = setNotifyRenderer as unknown as (
  callback: (message: string) => void
) => void
const addDirectory = addDirectoryToLibrary as unknown as (
  selectedPath: string,
  options: {
    notifyRenderer: (message: string) => void
    invalidateDirectoryCache: (dirPath?: string | null) => void
  }
) => Promise<unknown>

function handleFilehandler<C extends FilehandlerChannel>(
  channel: C,
  handler: FilehandlerInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as FilehandlerArgs<C>)))
}

export function invalidateDirectoryCache(dirPath: string | null = null): void {
  clearPendingDirectoriesRequest()
  invalidateFeedCollectionsCache('all')
  clearAudioCaches(dirPath)
}

function setupSignalFileWatcher(): void {
  const signalFilePath = getStoragePaths().signalFilePath
  if (fs.existsSync(signalFilePath)) {
    log.info('File exists, starting watch:', signalFilePath)

    fs.watch(signalFilePath, (_eventType, filename) => {
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

export function setupFilehandlers(): void {
  registerNotifyRenderer((message: string) => sendNotification(message))
  setupSignalFileWatcher()

  handleFilehandler('add-directory', async (_event, providedPath = null) => {
    try {
      let selectedPath = providedPath

      if (!selectedPath) {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory']
        })

        if (result.canceled) {
          return null
        }

        selectedPath = result.filePaths[0] || null
      }

      if (!selectedPath) {
        return null
      }

      return await addDirectory(selectedPath, {
        notifyRenderer: sendNotification,
        invalidateDirectoryCache
      })
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  handleFilehandler('get-new-audio-files', async () => {
    try {
      const recentAudioFiles = (await db.songs.findMany({
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          filepath: true
        },
        take: 5
      })) as Array<{ filepath: string }>

      const filepathsArray = recentAudioFiles.map((song) => song.filepath)
      return getAudioFileInfos(filepathsArray, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving latest audio files:', error)
      throw error
    }
  })

  handleFilehandler('get-all-audio-files', async (_event, currentPage) => {
    try {
      if (currentPage) {
        const pageResult = await getAudioFilesPage(currentPage)
        return pageResult.items
      }

      const uniqueAudioFiles = await getUniqueAudioPaths()

      return getAudioFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  handleFilehandler('get-all-audio-files-page', async (_event, request) => {
    try {
      return await getAudioFilesPage(request)
    } catch (error) {
      console.error('Error retrieving paginated audio files:', error)
      throw error
    }
  })

  handleFilehandler('get-audio-cover-thumbnail', async (_event, filePath) => {
    try {
      return await getAudioCover(filePath, 'thumb')
    } catch (error) {
      console.error('Error retrieving audio cover thumbnail:', error)
      throw error
    }
  })

  handleFilehandler('get-audio-cover-full', async (_event, filePath) => {
    try {
      return await getAudioCover(filePath, 'full')
    } catch (error) {
      console.error('Error retrieving full audio cover:', error)
      throw error
    }
  })

  handleFilehandler('get-all-audio-files-number', async () => {
    try {
      const uniqueAudioFiles = await getUniqueAudioPaths()

      return uniqueAudioFiles.length
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  handleFilehandler('get-audio-in-directory', async (_event, directoryPath) => {
    try {
      return getAudioInDirectory(directoryPath)
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  handleFilehandler('collection:get-overview', async (_event, request) => {
    try {
      return await getCollectionOverview(request)
    } catch (error) {
      console.error('Error retrieving collection overview:', error)
      return { success: false, error: getErrorMessage(error, 'Could not load the collection.') }
    }
  })

  handleFilehandler('collection:get-tracks-page', async (_event, request) => {
    try {
      return await getCollectionTracksPage(request)
    } catch (error) {
      console.error('Error retrieving collection tracks page:', error)
      return { success: false, error: getErrorMessage(error, 'Could not load songs.') }
    }
  })

  handleFilehandler('collection:get-playlist-edit-payload', async (_event, playlistPath) => {
    try {
      return await getPlaylistEditPayload(playlistPath)
    } catch (error) {
      console.error('Error retrieving playlist edit payload:', error)
      return { success: false, error: getErrorMessage(error, 'No se pudo cargar la playlist.') }
    }
  })

  handleFilehandler('feed:get-collection-rankings', async (_event, request) => {
    try {
      return await getFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error retrieving feed collection rankings:', error)
      return { success: false as const, error: getErrorMessage(error, 'No se pudo cargar el feed.') }
    }
  })

  handleFilehandler('feed:refresh-collection-rankings', async (_event, request) => {
    try {
      return await refreshFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error refreshing feed collection rankings:', error)
      return {
        success: false as const,
        error: getErrorMessage(error, 'No se pudo actualizar el feed.')
      }
    }
  })

  handleFilehandler('feed:get-collection-cover', async (_event, request) => {
    try {
      return await getFeedCollectionCover(request)
    } catch (error) {
      console.error('Error retrieving feed collection cover:', error)
      return null
    }
  })

  handleFilehandler('delete-directory', async (_event, dirPath) => {
    return deleteDirectory(dirPath, { invalidateDirectoryCache })
  })

  handleFilehandler('delete-directory-branch', async (_event, request) => {
    return deleteDirectoryBranch(request, { invalidateDirectoryCache })
  })

  handleFilehandler('get-all-directories', async () => {
    try {
      return await getAllDirectories()
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })

  handleFilehandler('get-directories-number', async () => {
    try {
      return await getDirectoriesNumber()
    } catch (error) {
      console.error('Error retrieving directories count:', error)
      throw error
    }
  })

  handleFilehandler('get-random-directory', async () => {
    return await getRandomDirectory()
  })

  handleFilehandler('search-directories-page', async (_event, request) => {
    return searchDirectoriesPage(request)
  })

  handleFilehandler('reveal-path-in-explorer', async (_event, targetPath) => {
    return revealPathInExplorer(targetPath)
  })

  handleFilehandler('open-directory-in-explorer', async (_event, targetPath) => {
    return openDirectoryInExplorer(targetPath)
  })
}
