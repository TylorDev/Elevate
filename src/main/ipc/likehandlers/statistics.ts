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
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  CollectionSummary,
  InsightRankingId,
  PageRequest,
  RankingMetricKey,
  RankingPage,
  SongRecordWithPreferences,
  StatisticsOverviewResult,
  StatisticsRankingPageRequest,
  StatisticsRankingPageResult
} from '../../Types/likeHandlers.ts'

const db = prisma as unknown as PrismaClient
const mapSongToFileInfo = mapSongRecordToFileInfo as (
  song: SongRecordWithPreferences | null | undefined
) => AudioFileInfo | null
const buildCollectionSummary = buildCollectionSummaryFromFileInfos as (
  tracks: AudioFileInfo[]
) => CollectionSummary
const buildAudioRankingPage = buildRankingPageFromTracks as (
  tracks: AudioFileInfo[],
  metricKey: RankingMetricKey,
  request: PageRequest
) => RankingPage<AudioFileInfo>

export async function getStatisticsOverview(
  request: PageRequest = {}
): Promise<StatisticsOverviewResult> {
  const songs = await db.songs.findMany({
    include: {
      UserPreferences: {
        select: USER_PREFERENCE_TRACK_SELECT
      }
    }
  })
  const tracks = songs
    .map((song) => mapSongToFileInfo(song as SongRecordWithPreferences))
    .filter((track): track is AudioFileInfo => Boolean(track))

  return {
    success: true,
    type: 'library',
    meta: {
      title: 'Estadisticas'
    },
    summary: buildCollectionSummary(tracks),
    rankings: buildInsightRankingsFromTracks(tracks, request)
  }
}

export async function getStatisticsRankingPage(
  request: StatisticsRankingPageRequest = {}
): Promise<StatisticsRankingPageResult> {
  const tabId = String(request?.tabId || '') as InsightRankingId
  const metricKey = INSIGHT_METRIC_KEYS[tabId]

  if (!metricKey) {
    return { success: false, error: 'Invalid ranking tab' }
  }

  const songs = await db.songs.findMany({
    include: {
      UserPreferences: {
        select: USER_PREFERENCE_TRACK_SELECT
      }
    }
  })
  const tracks = songs
    .map((song) => mapSongToFileInfo(song as SongRecordWithPreferences))
    .filter((track): track is AudioFileInfo => Boolean(track))

  return {
    success: true,
    ranking: buildAudioRankingPage(tracks, metricKey, normalizeRankingPageRequest(request))
  }
}
