import { ipcMain } from 'electron'
import log from 'electron-log/main.js'
import { ensurePlaylistCover, enrichPlaylistWithCover, updatePlaylistMetadata } from './covers.ts'
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
import { addNewSongToPlaylist, appendTracksToPlaylist, removeTrackFromPlaylist } from './tracks.ts'
import { getErrorMessage } from './shared.ts'
import type {
  EnsurePlaylistCoverRequest,
  PlaylistArgs,
  PlaylistChannel,
  PlaylistInvokeHandler
} from '../../Types/playlistHandlers.ts'
import type { CoverVariant } from '../../Types/shared.ts'

export {
  exportPlaylistToTarget,
  getPlaylistEditPayload,
  getPlaylistOverview,
  getPlaylistTracksPage,
  importPlaylistFile,
  savePlaylistToTarget
}
export type * from '../../Types/playlistHandlers.ts'

function handlePlaylist<C extends PlaylistChannel>(
  channel: C,
  handler: PlaylistInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as PlaylistArgs<C>)))
}

function parseCoverRequest(request: EnsurePlaylistCoverRequest): {
  playlistPath: string | null | undefined
  variant: CoverVariant
} {
  const playlistPath = typeof request === 'string' ? request : request?.playlistPath
  const variant =
    request && typeof request === 'object' && request?.variant ? request.variant : 'full'

  return { playlistPath, variant }
}

export function setupPlaylistHandlers(): void {
  handlePlaylist('load-list', async (_event, explicitFilePath = null) => {
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
      return { success: false, error: getErrorMessage(err) }
    }
  })

  handlePlaylist('get-list', async (_event, filepath) => {
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
      log.error('get-list error:', getErrorMessage(err))
      log.error('Stack:', err instanceof Error ? err.stack : null)
      return { success: false, error: getErrorMessage(err) }
    }
  })

  handlePlaylist('playlist:ensure-cover', async (_event, request) => {
    const { playlistPath, variant } = parseCoverRequest(request)
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: true
    })
  })

  handlePlaylist('playlist:get-cover', async (_event, request) => {
    const { playlistPath, variant } = parseCoverRequest(request)
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: false
    })
  })

  handlePlaylist('get-playlists', async () => {
    return await getPlaylists({}, enrichPlaylistWithCover)
  })

  handlePlaylist('get-playlists-minimal', async () => {
    return await getPlaylistsMinimal()
  })

  handlePlaylist('search-playlists-page', async (_event, request) => {
    return searchPlaylistsPage(request, enrichPlaylistWithCover)
  })

  handlePlaylist('get-playlists-number', async () => {
    return getPlaylistsNumber()
  })

  handlePlaylist('get-random-playlist', async () => {
    return await getRandomPlaylist(enrichPlaylistWithCover)
  })

  handlePlaylist('delete-playlist', async (event, filePath) => {
    return queuePlaylistDelete(filePath, event.sender)
  })

  handlePlaylist('update-playlist-metadata', async (_event, request) => {
    return updatePlaylistMetadata(request)
  })

  handlePlaylist('load-list-to-history', async (_event, filePath) => {
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

  handlePlaylist('update-list', async (_event, request) => {
    return removeTrackFromPlaylist(request)
  })

  handlePlaylist('add-new-song', async (_event, request) => {
    return addNewSongToPlaylist(request)
  })

  handlePlaylist('append-tracks-to-playlist', async (_event, request) => {
    return appendTracksToPlaylist(request)
  })

  handlePlaylist('save-m3u', async (_event, request = {}) => {
    try {
      return saveM3uRequest(request)
    } catch (err) {
      return { success: false, error: getErrorMessage(err) }
    }
  })
}
