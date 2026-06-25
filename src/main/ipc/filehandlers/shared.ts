// @ts-nocheck
import { buildRankingPageFromTracks } from '../utils/utils.ts'

export const INSIGHT_METRIC_KEYS = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export const FEED_SCOPE_VALUES = new Set(['mixed', 'playlists', 'directories'])

export const FEED_RANKING_TABS = {
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

export function buildInsightRankingsFromTracks(tracks = [], request = {}) {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce((rankings, [tabId, metricKey]) => {
    rankings[tabId] = buildRankingPageFromTracks(tracks, metricKey, { page, pageSize })
    return rankings
  }, {})
}

export function normalizeCollectionPageRequest(request = {}) {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function normalizeAudioPageRequest(request = {}) {
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

export function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

export function getPathLeaf(pathValue = '') {
  const normalizedPath = String(pathValue).replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || normalizedPath
}

export function getRandomIndex(total) {
  return Math.floor(Math.random() * total)
}

export function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function getDirectoryChildrenCount(directory) {
  return toNumber(directory?._count?.children ?? directory?.childrenCount)
}

export function getDirectoryKind(directory) {
  return toNumber(directory?.totalTracks) === 0 && getDirectoryChildrenCount(directory) > 0
    ? 'root'
    : 'normal'
}

export function isRootDirectoryRecord(directory) {
  return getDirectoryKind(directory) === 'root'
}

export function getLatestIsoDate(values = []) {
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

export function getCollectionRecentActivity(tracks = [], extraDate = null) {
  return getLatestIsoDate([
    extraDate,
    ...tracks.map((track) => track?.lastPlayedAt).filter(Boolean)
  ])
}

export function normalizeFeedRankingsRequest(request = {}) {
  const scope = FEED_SCOPE_VALUES.has(request?.scope) ? request.scope : 'mixed'

  return {
    scope,
    tabId: typeof request?.tabId === 'string' ? request.tabId : '',
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 30, 1), 100),
    forceRefresh: Boolean(request?.forceRefresh)
  }
}
