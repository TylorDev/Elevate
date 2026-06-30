import { buildRankingPageFromTracks } from '../../utils/utils.ts'
import type {
  AudioFileInfo,
  InsightRankingId,
  InsightRankings,
  LikeInsightMetricKeys,
  NormalizedPageRequest,
  PageRequest,
  PlaybackEventType,
  RankingMetricKey
} from '../../Types/likeHandlers.ts'

const buildAudioRankingPage = buildRankingPageFromTracks as (
  tracks: AudioFileInfo[],
  metricKey: RankingMetricKey,
  request?: PageRequest
) => InsightRankings[InsightRankingId]

export const PLAYBACK_EVENT_TYPES: ReadonlySet<PlaybackEventType> = new Set<PlaybackEventType>([
  'short-view-award',
  'long-view-award',
  'repeat-award',
  'skip-award',
  'playback-finalize'
])

export const STAT_SELECT = {
  play_count: true,
  skip_count: true,
  short_view_count: true,
  long_view_count: true,
  long_play_seconds: true,
  active_listening_seconds: true,
  consecutive_repeat_count: true,
  bpm: true,
  is_favorite: true
} as const

export const INSIGHT_METRIC_KEYS: LikeInsightMetricKeys = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error')
}

export function withoutPictures<T extends AudioFileInfo>(fileInfos: T[]): T[] {
  return fileInfos.map((fileInfo) => ({ ...fileInfo, picture: undefined }))
}

export function buildInsightRankingsFromTracks(
  tracks: AudioFileInfo[] = [],
  request: PageRequest = {}
): InsightRankings {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce<InsightRankings>(
    (rankings, [tabId, metricKey]) => {
      rankings[tabId as InsightRankingId] = buildAudioRankingPage(tracks, metricKey, {
        page,
        pageSize
      })
      return rankings
    },
    {}
  )
}

export function normalizeRankingPageRequest(request: PageRequest = {}): NormalizedPageRequest {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function toDayKey(value: string | number | Date | null | undefined): string | null {
  const date = new Date(value || '')

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}
