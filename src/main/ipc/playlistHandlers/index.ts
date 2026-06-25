// @ts-nocheck
import { ipcMain } from 'electron'
import log from 'electron-log/main.js'
import {
  ensurePlaylistCover,
  enrichPlaylistWithCover,
  updatePlaylistMetadata
} from './covers.ts'
import {
  getPlaylistEditPayload,
  getPlaylistListPayload,
  getPlaylistOverview,
  getPlaylistTracksPage
} from './collections.ts'
import {
  exportPlaylistToTarget,
  importPlaylistFile,
  saveM3uRequest,
  savePlaylistToTarget,
  selectFile
} from './m3uFiles.ts'
import {
  getPlaylist,
  getPlaylists,
  getPlaylistsMinimal,
  getPlaylistsNumber,
  getRandomPlaylist,
  incrementCounter,
  queuePlaylistDelete,
  searchPlaylistsPage
} from './repository.ts'
import {
  addNewSongToPlaylist,
  appendTracksToPlaylist,
  removeTrackFromPlaylist
} from './tracks.ts'

export {
  exportPlaylistToTarget,
  getPlaylistEditPayload,
  getPlaylistOverview,
  getPlaylistTracksPage,
  importPlaylistFile,
  savePlaylistToTarget
}

export function setupPlaylistHandlers() {
  ipcMain.handle('load-list', async (_event, explicitFilePath = null) => {
    try {
      const filePath =
        typeof explicitFilePath === 'string' && explicitFilePath.trim() !== ''
          ? explicitFilePath.trim()
          : await selectFile()
      if (!filePath) return { success: false, canceled: true, error: 'Import canceled' }
      const result = await importPlaylistFile(filePath)

      if (!result.success) {
        return { success: false, error: result.error }
      }

      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-list', async (event, filepath) => {
    if (!filepath || filepath === '') {
      log.error('get-list: filepath is empty or undefined')
      return { success: false, error: 'filepath is required' }
    }
    try {
      log.info('get-list: loading playlist:', filepath)
      const payload = await getPlaylistListPayload(filepath)

      log.info('get-list: loaded successfully')
      return payload
    } catch (err) {
      log.error('get-list error:', err.message)
      log.error('Stack:', err.stack)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('playlist:ensure-cover', async (_event, request) => {
    const playlistPath = typeof request === 'string' ? request : request?.playlistPath
    const variant = typeof request === 'object' ? request?.variant || 'full' : 'full'
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: true
    })
  })

  ipcMain.handle('playlist:get-cover', async (_event, request) => {
    const playlistPath = typeof request === 'string' ? request : request?.playlistPath
    const variant = typeof request === 'object' ? request?.variant || 'full' : 'full'
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: false
    })
  })

  //Simple
  ipcMain.handle('get-playlists', async () => {
    return await getPlaylists({}, enrichPlaylistWithCover)
  })

  ipcMain.handle('get-playlists-minimal', async () => {
    return await getPlaylistsMinimal()
  })

  ipcMain.handle('search-playlists-page', async (event, request) => {
    return searchPlaylistsPage(request, enrichPlaylistWithCover)
  })

  ipcMain.handle('get-playlists-number', async () => {
    return getPlaylistsNumber()
  })

  ipcMain.handle('get-random-playlist', async () => {
    return await getRandomPlaylist(enrichPlaylistWithCover)
  })

  //simple
  ipcMain.handle('delete-playlist', async (event, filePath) => {
    return queuePlaylistDelete(filePath, event.sender)
  })

  ipcMain.handle('update-playlist-metadata', async (event, request) => {
    return updatePlaylistMetadata(request)
  })

  ipcMain.handle('load-list-to-history', async (event, filePath) => {
    try {
      const playlist = await getPlaylist(filePath)
      if (!playlist) {
        console.log(`Playlist not found for path: ${filePath}`)
        return
      }

      await incrementCounter(playlist.id)

      console.log('Playlist added to history and play count updated successfully')
    } catch (error) {
      console.error('Error adding playlist to history:', error)
    }
  })

  ipcMain.handle('update-list', async (event, request) => {
    return removeTrackFromPlaylist(request)
  })

  ipcMain.handle('add-new-song', async (event, request) => {
    return addNewSongToPlaylist(request)
  })

  ipcMain.handle('append-tracks-to-playlist', async (event, request) => {
    return appendTracksToPlaylist(request)
  })

  ipcMain.handle('save-m3u', async (event, request = {}) => {
    try {
      return saveM3uRequest(request)
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
