// @ts-nocheck
import {
  buildCollectionSummaryFromFileInfos,
  buildRankingPageFromTracks,
  mapSongRecordToFileInfo,
  USER_PREFERENCE_TRACK_SELECT
} from '../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import {
  buildInsightRankingsFromTracks,
  INSIGHT_METRIC_KEYS,
  normalizeRankingPageRequest
} from './shared.ts'

export async function getStatisticsOverview(request = {}) {
  const songs = await prisma.songs.findMany({
    include: {
      UserPreferences: {
        select: USER_PREFERENCE_TRACK_SELECT
      }
    }
  })
  const tracks = songs.map((song) => mapSongRecordToFileInfo(song)).filter(Boolean)

  return {
    success: true,
    type: 'library',
    meta: {
      title: 'Estadisticas'
    },
    summary: buildCollectionSummaryFromFileInfos(tracks),
    rankings: buildInsightRankingsFromTracks(tracks, request)
  }
}

export async function getStatisticsRankingPage(request = {}) {
  const tabId = String(request?.tabId || '')
  const metricKey = INSIGHT_METRIC_KEYS[tabId]

  if (!metricKey) {
    return { success: false, error: 'Invalid ranking tab' }
  }

  const songs = await prisma.songs.findMany({
    include: {
      UserPreferences: {
        select: USER_PREFERENCE_TRACK_SELECT
      }
    }
  })
  const tracks = songs.map((song) => mapSongRecordToFileInfo(song)).filter(Boolean)

  return {
    success: true,
    ranking: buildRankingPageFromTracks(tracks, metricKey, normalizeRankingPageRequest(request))
  }
}
