import { buildRankingPageFromTracks } from '../utils/utils.ts'
import type {
  AudioFileInfo,
  DirectoryKind,
  DirectoryWithChildrenCount,
  FeedRankingTab,
  FeedRankingTabId,
  FeedRankingsRequest,
  FeedScope,
  InsightRankingId,
  InsightRankings,
  NormalizedPageRequest,
  NormalizedFeedRankingsRequest,
  PageRequest,
  RankingMetricKey
} from '../../Types/filehandlers.ts'

export const INSIGHT_METRIC_KEYS: Record<InsightRankingId, RankingMetricKey> = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export const FEED_SCOPE_VALUES = new Set<FeedScope>(['mixed', 'playlists', 'directories'])

export const FEED_RANKING_TABS: Record<FeedRankingTabId, FeedRankingTab> = {
  recent: {
    metricKey: 'recentActivityAt',
    direction: 'date'
  },
  shortViews: {
    metricKey: 'totalShortViews',
    direction: 'number'
  },
  longViews: {
    metricKey: 'totalLongViews',
    direction: 'number'
  },
  duration: {
    metricKey: 'totalDuration',
    direction: 'number'
  },
  accumulatedDuration: {
    metricKey: 'totalAccumulatedDuration',
    direction: 'number'
  },
  repeats: {
    metricKey: 'totalRepeats',
    direction: 'number'
  },
  skips: {
    metricKey: 'totalSkips',
    direction: 'number'
  }
}

export function getErrorMessage(error: unknown, fallback = 'Unexpected error.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function buildInsightRankingsFromTracks(
  tracks: AudioFileInfo[] = [],
  request: PageRequest = {}
): InsightRankings {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce<InsightRankings>((rankings, [tabId, metricKey]) => {
    rankings[tabId as InsightRankingId] = buildRankingPageFromTracks(tracks, metricKey, {
      page,
      pageSize
    })
    return rankings
  }, {})
}

export function normalizeCollectionPageRequest(request: PageRequest = {}): NormalizedPageRequest {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function normalizeAudioPageRequest(
  request: number | PageRequest | null | undefined = {}
): NormalizedPageRequest {
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

export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

export function getPathLeaf(pathValue: unknown = ''): string {
  const normalizedPath = String(pathValue).replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || normalizedPath
}

export function getRandomIndex(total: number): number {
  return Math.floor(Math.random() * total)
}

export function toNumber(value: unknown): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function getDirectoryChildrenCount(directory: DirectoryWithChildrenCount | null | undefined): number {
  return toNumber(directory?._count?.children ?? directory?.childrenCount)
}

export function getDirectoryKind(directory: DirectoryWithChildrenCount | null | undefined): DirectoryKind {
  return toNumber(directory?.totalTracks) === 0 && getDirectoryChildrenCount(directory) > 0
    ? 'root'
    : 'normal'
}

export function isRootDirectoryRecord(directory: DirectoryWithChildrenCount | null | undefined): boolean {
  return getDirectoryKind(directory) === 'root'
}

export function getLatestIsoDate(values: Array<Date | string | null | undefined> = []): string | null {
  const latestTimestamp = values.reduce((latest, value) => {
    if (!value) {
      return latest
    }

    const timestamp = new Date(value).getTime()

    if (!Number.isFinite(timestamp)) {
      return latest
    }

    return Math.max(latest, timestamp)
  }, 0)

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null
}

export function getCollectionRecentActivity(
  tracks: AudioFileInfo[] = [],
  extraDate: Date | string | null = null
): string | null {
  return getLatestIsoDate([
    extraDate,
    ...tracks.map((track) => track?.lastPlayedAt).filter(Boolean)
  ])
}

export function normalizeFeedRankingsRequest(
  request: FeedRankingsRequest = {}
): NormalizedFeedRankingsRequest {
  const requestedScope = request?.scope
  const scope =
    typeof requestedScope === 'string' && FEED_SCOPE_VALUES.has(requestedScope as FeedScope)
      ? (requestedScope as FeedScope)
      : 'mixed'
  const tabId = typeof request?.tabId === 'string' ? request.tabId : ''

  return {
    scope,
    tabId: tabId in FEED_RANKING_TABS ? (tabId as FeedRankingTabId) : '',
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 30, 1), 100),
    forceRefresh: Boolean(request?.forceRefresh)
  }
}
