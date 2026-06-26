// @ts-nocheck
import { ipcMain } from 'electron'
import { getFileInfos } from '../utils/utils.ts'
import {
  getLikesOverview,
  getLikesTracksPage
} from './collections.ts'
import {
  getMostPlayedSongsWithDetails,
  getPlayHistoryOrdered,
  getRecentHistoryOrdered,
  getSongHistoryTimeline
} from './history.ts'
import { recordPlaybackStats } from './playback.ts'
import {
  checkSongLiked,
  getLikes,
  getLikesNumber,
  getListenLater,
  likeSong,
  listenLaterSong,
  removeListenLater,
  unlikeSong
} from './preferences.ts'
import { searchSongsPage } from './search.ts'
import {
  getStatisticsOverview,
  getStatisticsRankingPage
} from './statistics.ts'

export {
  getLikesOverview,
  getLikesTracksPage
}

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, common) => {
    return likeSong(common)
  })

  ipcMain.handle('is-song-liked', async (event, filepath, filename) => {
    return checkSongLiked(filepath, filename)
  })

  ipcMain.handle('playback:record', async (event, payload) => {
    try {
      return await recordPlaybackStats(payload)
    } catch (error) {
      console.error('Error recording playback stats:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unlike-song', (event, common) => {
    return unlikeSong(common)
  })

  ipcMain.handle('get-likes', async (event) => {
    return await getLikes()
  })

  ipcMain.handle('get-likes-number', async (event) => {
    return getLikesNumber()
  })

  ipcMain.handle('listen-later-song', async (event, filepath, filename) => {
    return listenLaterSong(filepath, filename)
  })

  ipcMain.handle('get-listen-later', async (event) => {
    return getListenLater()
  })

  ipcMain.handle('get-history', async (event, page) => {
    return getPlayHistoryOrdered(page)
  })

  ipcMain.handle('history:get-song-timeline', async (event, request) => {
    return getSongHistoryTimeline(request)
  })

  ipcMain.handle('get-recents', async (event) => {
    const likes = await getRecentHistoryOrdered()
    return likes.slice(0, 5) // Mostrar solo los primeros 5 elementos unicos
  })

  ipcMain.handle('get-most-played', async (event) => {
    const paths = await getMostPlayedSongsWithDetails()
    return getFileInfos(paths, { includePicture: false })
  })

  ipcMain.handle('statistics:get-overview', async (event, request) => {
    try {
      return await getStatisticsOverview(request)
    } catch (error) {
      console.error('Error retrieving statistics overview:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('statistics:get-ranking-page', async (event, request) => {
    try {
      return await getStatisticsRankingPage(request)
    } catch (error) {
      console.error('Error retrieving statistics ranking page:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('remove-listen-later', (event, filepath, filename) => {
    return removeListenLater(filepath, filename)
  })
}

export function setupMusicHandlers() {
  ipcMain.handle('search-songs-page', async (event, request) => {
    return searchSongsPage(request)
  })
}
