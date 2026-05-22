import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FixedSizeList } from 'react-window'
import {
  LuActivity,
  LuClock3,
  LuEye,
  LuListMusic,
  LuRefreshCw,
  LuRepeat2,
  LuSkipForward
} from 'react-icons/lu'
import { formatDuration } from '../../../timeUtils'
import { CollectionCard } from '../../components/CollectionCard/CollectionCard'
import { CollectionEntityItem } from './components/CollectionEntityItem'
import './Feed.scss'

const FEED_PAGE_SIZE = 30
const FEED_ROW_HEIGHT = 86
const FEED_OVERSCAN_COUNT = 6
const FEED_LIST_MIN_HEIGHT = 260

const SCOPE_OPTIONS = [
  { id: 'mixed', label: 'Mixto' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'directories', label: 'Directorios' }
]

const RANKING_TABS = [
  {
    id: 'recent',
    label: 'Actividad reciente',
    boardLabel: 'Actividad reciente',
    summaryLabel: 'Reciente',
    icon: LuActivity,
    tone: 'acid',
    metricKey: 'recentActivityAt',
    formatValue: (_, rows = []) => formatMetricValue(rows.length),
    formatItemValue: (item) => formatRecentActivity(item?.recentActivityAt)
  },
  {
    id: 'shortViews',
    label: 'Short Views',
    boardLabel: 'Top Short Views',
    summaryLabel: 'Short Views',
    icon: LuEye,
    tone: 'gold',
    metricKey: 'totalShortViews',
    formatValue: (value) => formatMetricValue(value),
    formatItemValue: (item) => formatMetricValue(item?.totalShortViews)
  },
  {
    id: 'longViews',
    label: 'Long Views',
    boardLabel: 'Top Long Views',
    summaryLabel: 'Long Views',
    icon: LuListMusic,
    tone: 'blue',
    metricKey: 'totalLongViews',
    formatValue: (value) => formatMetricValue(value),
    formatItemValue: (item) => formatMetricValue(item?.totalLongViews)
  },
  {
    id: 'duration',
    label: 'Duration Total',
    boardLabel: 'Top Duration Total',
    summaryLabel: 'Duration Total',
    icon: LuClock3,
    tone: 'neutral',
    metricKey: 'totalDuration',
    formatValue: (value) => formatDuration(Number(value) || 0),
    formatItemValue: (item) => formatDuration(Number(item?.totalDuration) || 0)
  },
  {
    id: 'accumulatedDuration',
    label: 'Duracion Acumulada',
    boardLabel: 'Top Duracion Acumulada',
    summaryLabel: 'Duracion Acumulada',
    icon: LuClock3,
    tone: 'violet',
    metricKey: 'totalAccumulatedDuration',
    formatValue: (value) => formatAccumulatedDuration(value),
    formatItemValue: (item) => formatAccumulatedDuration(item?.totalAccumulatedDuration)
  },
  {
    id: 'repeats',
    label: 'Repeticiones',
    boardLabel: 'Top Repeticiones',
    summaryLabel: 'Repeticiones',
    icon: LuRepeat2,
    tone: 'rose',
    metricKey: 'totalRepeats',
    formatValue: (value) => formatMetricValue(value),
    formatItemValue: (item) => formatMetricValue(item?.totalRepeats)
  },
  {
    id: 'skips',
    label: 'Skips',
    boardLabel: 'Top Skips',
    summaryLabel: 'Skips',
    icon: LuSkipForward,
    tone: 'ash',
    metricKey: 'totalSkips',
    formatValue: (value) => formatMetricValue(value),
    formatItemValue: (item) => formatMetricValue(item?.totalSkips)
  }
]

function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function formatMetricValue(value) {
  return new Intl.NumberFormat('es').format(toNumber(value))
}

function formatAccumulatedDuration(seconds) {
  const totalSeconds = Math.max(0, toNumber(seconds))
  const hours = totalSeconds / 3600

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }

  return `${Math.round(totalSeconds / 60)} min`
}

function formatRecentActivity(value) {
  if (!value) {
    return 'Sin actividad'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sin actividad'
  }

  return new Intl.DateTimeFormat(navigator.language, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function mergeRankingPage(currentRanking, nextRanking) {
  if (!nextRanking) return currentRanking

  const currentItems = Array.isArray(currentRanking?.items) ? currentRanking.items : []
  const nextItems = Array.isArray(nextRanking?.items) ? nextRanking.items : []

  if (nextRanking.page <= (currentRanking?.page || 0)) {
    return currentRanking
  }

  return {
    ...nextRanking,
    items: [...currentItems, ...nextItems]
  }
}

function getRankingRows(ranking) {
  return Array.isArray(ranking?.items) ? ranking.items : []
}

const CollectionEntityRow = memo(function CollectionEntityRow({ index, style, data }) {
  const collection = data.items[index]

  if (!collection) {
    return null
  }

  return (
    <CollectionEntityItem
      collection={collection}
      insightValueLabel={data.activeTab.formatItemValue(collection)}
      onOpen={() => data.onOpenCollection(collection)}
      style={style}
    />
  )
})

function Feed() {
  const navigate = useNavigate()
  const listWrapRef = useRef(null)
  const [scope, setScope] = useState('mixed')
  const [activeTabId, setActiveTabId] = useState('recent')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [switchingScope, setSwitchingScope] = useState(false)
  const [rankingLoadingTab, setRankingLoadingTab] = useState('')
  const [listHeight, setListHeight] = useState(FEED_LIST_MIN_HEIGHT)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true

    async function loadFeed() {
      setLoading((currentLoading) => currentLoading || !overview)
      setSwitchingScope(Boolean(overview))
      setError('')

      try {
        const response = await window.electron.ipcRenderer.invoke('feed:get-collection-rankings', {
          scope,
          page: 1,
          pageSize: FEED_PAGE_SIZE
        })

        if (!alive) return

        if (!response?.success) {
          setError(response?.error || 'No se pudo cargar el Feed.')
          setOverview(null)
          return
        }

        setOverview(response)
      } catch (loadError) {
        if (alive) {
          setError(loadError?.message || 'No se pudo cargar el Feed.')
          setOverview(null)
        }
      } finally {
        if (alive) {
          setLoading(false)
          setSwitchingScope(false)
        }
      }
    }

    void loadFeed()

    return () => {
      alive = false
    }
  }, [scope])

  const activeTab = useMemo(
    () => RANKING_TABS.find((tab) => tab.id === activeTabId) || RANKING_TABS[0],
    [activeTabId]
  )
  const rankings = overview?.rankings || {}
  const activeRanking = rankings[activeTab.id]
  const activeRows = getRankingRows(activeRanking)
  const activeTotalValue =
    activeRanking?.totalValue ??
    activeRows.reduce((total, item) => total + toNumber(item?.[activeTab.metricKey]), 0)
  const scopeLabel = SCOPE_OPTIONS.find((option) => option.id === scope)?.label || 'Mixto'

  useEffect(() => {
    const listWrap = listWrapRef.current
    if (!listWrap) return

    const updateListHeight = () => {
      const nextHeight = Math.max(listWrap.clientHeight || 0, FEED_LIST_MIN_HEIGHT)
      setListHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      )
    }

    updateListHeight()

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateListHeight)
      return () => {
        window.removeEventListener('resize', updateListHeight)
      }
    }

    const resizeObserver = new window.ResizeObserver(updateListHeight)
    resizeObserver.observe(listWrap)

    return () => {
      resizeObserver.disconnect()
    }
  }, [activeRows.length])

  const handleLoadMoreRanking = useCallback(async () => {
    if (!activeRanking?.hasMore || rankingLoadingTab) {
      return
    }

    setRankingLoadingTab(activeTab.id)

    try {
      const response = await window.electron.ipcRenderer.invoke('feed:get-collection-rankings', {
        scope,
        tabId: activeTab.id,
        page: (activeRanking.page || 1) + 1,
        pageSize: activeRanking.pageSize || FEED_PAGE_SIZE
      })

      if (!response?.success) {
        throw new Error(response?.error || 'No se pudo cargar el ranking.')
      }

      setOverview((currentOverview) => ({
        ...currentOverview,
        rankings: {
          ...currentOverview.rankings,
          [activeTab.id]: mergeRankingPage(
            currentOverview.rankings?.[activeTab.id],
            response.rankings?.[activeTab.id]
          )
        }
      }))
    } catch (rankingError) {
      setError(rankingError?.message || 'No se pudo cargar el ranking.')
    } finally {
      setRankingLoadingTab('')
    }
  }, [activeRanking, activeTab.id, rankingLoadingTab, scope])

  const handleOpenCollection = useCallback(
    (collection) => {
      if (!collection?.path) return

      if (collection.type === 'playlist') {
        navigate(`/playlists/${encodeURIComponent(collection.path)}`)
        return
      }

      navigate(`/directories/${encodeURIComponent(collection.path)}/false`)
    },
    [navigate]
  )

  const virtualListData = useMemo(
    () => ({
      items: activeRows,
      activeTab,
      onOpenCollection: handleOpenCollection
    }),
    [activeRows, activeTab, handleOpenCollection]
  )

  if (loading) {
    return (
      <section className="Feed Feed--loading">
        <div className="feed-loading">
          <LuRefreshCw />
          Cargando Feed...
        </div>
      </section>
    )
  }

  if (error && !overview) {
    return (
      <section className="Feed Feed--error">
        <div className="feed-error-message">{error}</div>
      </section>
    )
  }

  return (
    <section className="Feed">
      <header className="feed-header">
        <div className="feed-header__copy">
          <span>Collection Feed</span>
          <h1>Directorios y Playlists</h1>
        </div>

        <div className="feed-scope-switch" role="tablist" aria-label="Filtrar colecciones">
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={scope === option.id}
              className={scope === option.id ? 'is-active' : ''}
              onClick={() => setScope(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {switchingScope ? (
        <div className="feed-inline-loading">
          <LuRefreshCw />
          Actualizando ranking...
        </div>
      ) : null}

      <div className="feed-ranking-cards" role="tablist" aria-label="Rankings de colecciones">
        {RANKING_TABS.map((tab) => {
          const Icon = tab.icon
          const ranking = rankings[tab.id]
          const rows = getRankingRows(ranking)
          const totalValue =
            ranking?.totalValue ??
            rows.reduce((total, item) => total + toNumber(item?.[tab.metricKey]), 0)

          return (
            <CollectionCard
              key={tab.id}
              as="button"
              role="tab"
              aria-selected={activeTab.id === tab.id}
              tone={tab.tone}
              active={activeTab.id === tab.id}
              interactive
              icon={<Icon />}
              label={tab.summaryLabel}
              value={tab.formatValue(totalValue, rows)}
              meta={`${formatMetricValue(ranking?.total || rows.length)} colecciones`}
              className="feed-ranking-card"
              onClick={() => setActiveTabId(tab.id)}
            />
          )
        })}
      </div>

      <div className={`feed-ranking-board tone-${activeTab.tone}`}>
        <div className="feed-ranking-board__header">
          <div>
            <span>{scopeLabel}</span>
            <h2>{activeTab.boardLabel}</h2>
          </div>
          <strong>{activeTab.formatValue(activeTotalValue, activeRows)}</strong>
        </div>

        {error ? <div className="feed-ranking-board__error">{error}</div> : null}

        {activeRows.length === 0 ? (
          <div className="feed-ranking-board__empty">
            No hay colecciones para este ranking.
          </div>
        ) : (
          <div ref={listWrapRef} className="feed-ranking-board__listWrap">
            <FixedSizeList
              className="feed-collection-list feed-collection-list--virtual"
              height={listHeight}
              itemCount={activeRows.length}
              itemData={virtualListData}
              itemKey={(index, data) => {
                const collection = data.items[index]
                return collection
                  ? `${collection.type}:${collection.path}`
                  : `collection-${index}`
              }}
              itemSize={FEED_ROW_HEIGHT}
              overscanCount={FEED_OVERSCAN_COUNT}
              width="100%"
            >
              {CollectionEntityRow}
            </FixedSizeList>
          </div>
        )}

        {activeRanking?.hasMore ? (
          <button
            type="button"
            className="feed-load-more"
            disabled={rankingLoadingTab === activeTab.id}
            onClick={() => void handleLoadMoreRanking()}
          >
            {rankingLoadingTab === activeTab.id ? 'Cargando...' : 'Cargar mas'}
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default Feed
