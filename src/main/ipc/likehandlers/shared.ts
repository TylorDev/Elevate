// @ts-nocheck
import { buildRankingPageFromTracks } from '../utils/utils.ts'

export const PLAYBACK_EVENT_TYPES = new Set([
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
}

export const INSIGHT_METRIC_KEYS = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export function withoutPictures(fileInfos) {
  return fileInfos.map((fileInfo) => ({ ...fileInfo, picture: undefined }))
}

export function buildInsightRankingsFromTracks(tracks = [], request = {}) {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce((rankings, [tabId, metricKey]) => {
    rankings[tabId] = buildRankingPageFromTracks(tracks, metricKey, { page, pageSize })
    return rankings
  }, {})
}

export function normalizeRankingPageRequest(request = {}) {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function toDayKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

export function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}
