import {
  LuClock3,
  LuEye,
  LuListMusic,
  LuRepeat2,
  LuSkipForward
} from 'react-icons/lu'
import { formatDuration } from '../../../timeUtils'

function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function formatAccumulatedDuration(seconds) {
  const totalSeconds = Math.max(0, toNumber(seconds))
  const hours = totalSeconds / 3600

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }

  return `${Math.round(totalSeconds / 60)} min`
}

export function formatMetricValue(value) {
  return new Intl.NumberFormat('en').format(toNumber(value))
}

export const COLLECTION_INSIGHT_TABS = [
  {
    id: 'allSongs',
    label: 'All Songs',
    boardLabel: 'All songs',
    summaryLabel: 'Full collection',
    metricKey: null,
    icon: LuListMusic,
    tone: 'neutral',
    getRows: (tracks) => tracks.slice(),
    formatValue: (_, rows) => formatMetricValue(rows.length)
  },
  {
    id: 'duration',
    label: 'Duration',
    boardLabel: 'Top Duration',
    summaryLabel: 'Duration',
    metricKey: 'duration',
    icon: LuClock3,
    tone: 'acid',
    getValue: (track) => toNumber(track?.duration),
    formatValue: (value) => formatDuration(Math.max(0, toNumber(value)))
  },
  {
    id: 'shortViews',
    label: 'Short Views',
    boardLabel: 'Top Short Views',
    summaryLabel: 'Short Views',
    metricKey: 'short_view_count',
    icon: LuEye,
    tone: 'gold',
    getValue: (track) => toNumber(track?.short_view_count),
    formatValue: (value) => formatMetricValue(value)
  },
  {
    id: 'longViews',
    label: 'Long Views',
    boardLabel: 'Top Long Views',
    summaryLabel: 'Long Views',
    metricKey: 'long_view_count',
    icon: LuListMusic,
    tone: 'blue',
    getValue: (track) => toNumber(track?.long_view_count),
    formatValue: (value) => formatMetricValue(value)
  },
  {
    id: 'accumulatedDuration',
    label: 'Accumulated Duration',
    boardLabel: 'Top Accumulated Duration',
    summaryLabel: 'Accumulated Duration',
    metricKey: 'active_listening_seconds',
    icon: LuClock3,
    tone: 'violet',
    getValue: (track) => toNumber(track?.active_listening_seconds),
    formatValue: (value) => formatAccumulatedDuration(value)
  },
  {
    id: 'repeats',
    label: 'Repetitions',
    boardLabel: 'Top Repetitions',
    summaryLabel: 'Repetitions',
    metricKey: 'consecutive_repeat_count',
    icon: LuRepeat2,
    tone: 'rose',
    getValue: (track) => toNumber(track?.consecutive_repeat_count),
    formatValue: (value) => formatMetricValue(value)
  },
  {
    id: 'skips',
    label: 'Total Skips',
    boardLabel: 'Top Skips',
    summaryLabel: 'Total Skips',
    metricKey: 'skip_count',
    icon: LuSkipForward,
    tone: 'ash',
    getValue: (track) => toNumber(track?.skip_count),
    formatValue: (value) => formatMetricValue(value)
  }
]

export const COLLECTION_INSIGHT_CARD_TABS = COLLECTION_INSIGHT_TABS.filter(
  (tab) => tab.id !== 'allSongs'
)

export function buildCollectionSummaryFromTracks(tracks = [], extras = {}) {
  return tracks.reduce(
    (summary, track) => ({
      ...summary,
      totalDuration: summary.totalDuration + toNumber(track?.duration),
      totalShortViews: summary.totalShortViews + toNumber(track?.short_view_count),
      totalLongViews: summary.totalLongViews + toNumber(track?.long_view_count),
      totalAccumulatedDuration:
        summary.totalAccumulatedDuration + toNumber(track?.active_listening_seconds),
      totalRepeats: summary.totalRepeats + toNumber(track?.consecutive_repeat_count),
      totalSkips: summary.totalSkips + toNumber(track?.skip_count),
      trackCount: summary.trackCount + 1
    }),
    {
      totalDuration: 0,
      totalShortViews: 0,
      totalLongViews: 0,
      totalAccumulatedDuration: 0,
      totalRepeats: 0,
      totalSkips: 0,
      trackCount: 0,
      ...extras
    }
  )
}

export function buildCollectionRankings(tracks = []) {
  const safeTracks = Array.isArray(tracks) ? tracks.slice() : []

  return COLLECTION_INSIGHT_TABS.reduce((rankings, tab) => {
    if (tab.id === 'allSongs') {
      rankings[tab.id] = safeTracks
      return rankings
    }

    rankings[tab.id] = safeTracks
      .filter((track) => tab.getValue(track) > 0)
      .sort((left, right) => tab.getValue(right) - tab.getValue(left))

    return rankings
  }, {})
}

export function getInsightAggregateValue(tab, rows = []) {
  if (!tab || tab.id === 'allSongs') {
    return rows.length
  }

  return rows.reduce((total, track) => total + tab.getValue(track), 0)
}

export function getInsightTrackValueLabel(tab, track) {
  if (!tab || tab.id === 'allSongs' || !track) {
    return ''
  }

  return tab.formatValue(tab.getValue(track))
}
