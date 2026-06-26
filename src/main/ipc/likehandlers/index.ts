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
import { getErrorMessage } from './shared.ts'
import type {
  AudioFileInfo,
  ErrorResponse,
  LikeArgs,
  LikeChannel,
  LikeInvokeHandler
} from '../../Types/likeHandlers.ts'

export {
  getLikesOverview,
  getLikesTracksPage
}
export type * from '../../Types/likeHandlers.ts'

const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>

function handleLike<C extends LikeChannel>(
  channel: C,
  handler: LikeInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as LikeArgs<C>)))
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return Boolean(value && typeof value === 'object' && 'success' in value && value.success === false)
}

export function setupLikeSongHandlers(): void {
  handleLike('like-song', async (_event, common) => {
    return likeSong(common)
  })

  handleLike('is-song-liked', async (_event, filepath, filename) => {
    return checkSongLiked(filepath, filename)
  })

  handleLike('playback:record', async (_event, payload) => {
    try {
      return await recordPlaybackStats(payload)
    } catch (error) {
      console.error('Error recording playback stats:', error)
      return { success: false, error: getErrorMessage(error) }
    }
  })

  handleLike('unlike-song', (_event, common) => {
    return unlikeSong(common)
  })

  handleLike('get-likes', async () => {
    return getLikes()
  })

  handleLike('get-likes-number', async () => {
    return getLikesNumber()
  })

  handleLike('listen-later-song', async (_event, filepath, filename) => {
    return listenLaterSong(filepath, filename)
  })

  handleLike('get-listen-later', async () => {
    return getListenLater()
  })

  handleLike('get-history', async (_event, page) => {
    return getPlayHistoryOrdered(page)
  })

  handleLike('history:get-song-timeline', async (_event, request) => {
    return getSongHistoryTimeline(request)
  })

  handleLike('get-recents', async () => {
    const likes = await getRecentHistoryOrdered()
    return Array.isArray(likes) ? likes.slice(0, 5) : likes
  })

  handleLike('get-most-played', async () => {
    const paths = await getMostPlayedSongsWithDetails()

    if (isErrorResponse(paths)) {
      return paths
    }

    return getAudioFileInfos(paths, { includePicture: false })
  })

  handleLike('statistics:get-overview', async (_event, request) => {
    try {
      return await getStatisticsOverview(request)
    } catch (error) {
      console.error('Error retrieving statistics overview:', error)
      return { success: false, error: getErrorMessage(error) }
    }
  })

  handleLike('statistics:get-ranking-page', async (_event, request) => {
    try {
      return await getStatisticsRankingPage(request)
    } catch (error) {
      console.error('Error retrieving statistics ranking page:', error)
      return { success: false, error: getErrorMessage(error) }
    }
  })

  handleLike('remove-listen-later', (_event, filepath) => {
    return removeListenLater(filepath)
  })
}

export function setupMusicHandlers(): void {
  handleLike('search-songs-page', async (_event, request) => {
    return searchSongsPage(request)
  })
}
