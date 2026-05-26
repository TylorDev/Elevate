import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { FixedSizeList } from 'react-window'
import {
  LuActivity,
  LuClock3,
  LuEye,
  LuFolderOpen,
  LuLayoutGrid,
  LuListMusic,
  LuRefreshCw,
  LuRepeat2,
  LuSkipForward
} from 'react-icons/lu'
import { formatDuration } from '../../../timeUtils'
import { CollectionCard } from '../../components/CollectionCard/CollectionCard'
import { CollectionInsightsLoadingShell } from '../../components/CollectionInsights/CollectionInsightsPanel'
import { Skeleton } from '../../components/Skeleton/Skeleton'
import { CollectionEntityItem } from './components/CollectionEntityItem'
import './Feed.scss'

const FEED_PAGE_SIZE = 30
const FEED_ROW_HEIGHTS = {
  default: 86,
  vertical: 76,
  horizontal: 60
}
const FEED_OVERSCAN_COUNT = 6
const FEED_LIST_MIN_HEIGHT = 86

const SCOPE_OPTIONS = [
  { id: 'mixed', label: 'Mixto', icon: LuLayoutGrid },
  { id: 'playlists', label: 'Playlists', icon: LuListMusic },
  { id: 'directories', label: 'Directorios', icon: LuFolderOpen }
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
      compactLayout={data.compactLayout}
      insightValueLabel={data.activeTab.formatItemValue(collection)}
      onOpen={() => data.onOpenCollection(collection)}
      style={style}
    />
  )
})

function Feed() {
  const outletContext = useOutletContext() || {}
  const navigate = useNavigate()
  const listWrapRef = useRef(null)
  const overviewCacheRef = useRef(new Map())
  const [scope, setScope] = useState('mixed')
  const [activeTabId, setActiveTabId] = useState('recent')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [switchingScope, setSwitchingScope] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [rankingLoadingTab, setRankingLoadingTab] = useState('')
  const [listHeight, setListHeight] = useState(FEED_LIST_MIN_HEIGHT)
  const [error, setError] = useState('')
  const shouldUseHorizontalCollectionLayout = Boolean(
    outletContext.shouldUseCollectionHorizontalMobileLayout
  )
  const shouldUseMobileCollectionLayout = Boolean(outletContext.shouldUseCollectionMobileLayout)
  const feedCompactLayout = shouldUseHorizontalCollectionLayout
    ? 'horizontal'
    : shouldUseMobileCollectionLayout
      ? 'vertical'
      : 'default'
  const shouldUseCompactFeedCards = feedCompactLayout !== 'default'
  const feedRowHeight = FEED_ROW_HEIGHTS[feedCompactLayout] || FEED_ROW_HEIGHTS.default
  const feedClassName = `Feed${feedCompactLayout === 'vertical' ? ' Feed--movil' : ''}${
    feedCompactLayout === 'horizontal' ? ' Feed--movil-horizontal' : ''
  }`

  useEffect(() => {
    let alive = true

    async function loadFeed() {
      let keepLoading = false
      const cachedOverview = overviewCacheRef.current.get(scope)

      if (cachedOverview) {
        setOverview(cachedOverview)
        setRefreshing(Boolean(cachedOverview.refreshing))
        setLoading(false)
        setSwitchingScope(false)
        setError('')
        return
      }

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

        if (response.cacheMiss && response.refreshing) {
          setRefreshing(true)
          keepLoading = true
          return
        }

        overviewCacheRef.current.set(scope, response)
        setOverview(response)
        setRefreshing(Boolean(response.refreshing))
      } catch (loadError) {
        if (alive) {
          setError(loadError?.message || 'No se pudo cargar el Feed.')
          setOverview(null)
        }
      } finally {
        if (alive) {
          setLoading(keepLoading)
          setSwitchingScope(false)
        }
      }
    }

    void loadFeed()

    return () => {
      alive = false
    }
  }, [scope])

  const loadUpdatedFeed = useCallback(
    async (targetScope = scope) => {
      try {
        const response = await window.electron.ipcRenderer.invoke('feed:get-collection-rankings', {
          scope: targetScope,
          page: 1,
          pageSize: FEED_PAGE_SIZE
        })

        if (!response?.success || response.cacheMiss) {
          return
        }

        overviewCacheRef.current.set(targetScope, response)

        if (targetScope === scope) {
          setOverview(response)
          setRefreshing(Boolean(response.refreshing))
          setLoading(false)
          setSwitchingScope(false)
        }
      } catch (updateError) {
        setError(updateError?.message || 'No se pudo recargar el Feed.')
      }
    },
    [scope]
  )

  useEffect(() => {
    const handleFeedUpdated = (payload) => {
      if (!payload?.scope) return

      overviewCacheRef.current.delete(payload.scope)
      setRefreshing(false)

      if (payload.scope === scope) {
        void loadUpdatedFeed(payload.scope)
      }
    }

    window.electron.ipcRenderer.on('feed:collection-rankings-updated', handleFeedUpdated)

    return () => {
      window.electron.ipcRenderer.removeAllListeners('feed:collection-rankings-updated')
    }
  }, [loadUpdatedFeed, scope])

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
      const styles = window.getComputedStyle(listWrap)
      const paddingTop = parseFloat(styles.paddingTop) || 0
      const paddingBottom = parseFloat(styles.paddingBottom) || 0
      const contentHeight = (listWrap.clientHeight || 0) - paddingTop - paddingBottom
      const nextHeight = Math.max(contentHeight, FEED_LIST_MIN_HEIGHT)
      setListHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
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

      setOverview((currentOverview) => {
        const nextOverview = {
          ...currentOverview,
          generatedAt: response.generatedAt || currentOverview?.generatedAt,
          rankings: {
            ...currentOverview.rankings,
            [activeTab.id]: mergeRankingPage(
              currentOverview.rankings?.[activeTab.id],
              response.rankings?.[activeTab.id]
            )
          }
        }

        overviewCacheRef.current.set(scope, nextOverview)
        return nextOverview
      })
    } catch (rankingError) {
      setError(rankingError?.message || 'No se pudo cargar el ranking.')
    } finally {
      setRankingLoadingTab('')
    }
  }, [activeRanking, activeTab.id, rankingLoadingTab, scope])

  const handleRefreshFeed = useCallback(async () => {
    if (refreshing) return

    setRefreshing(true)
    setError('')

    try {
      const response = await window.electron.ipcRenderer.invoke(
        'feed:refresh-collection-rankings',
        {
          scope
        }
      )

      if (!response?.success) {
        throw new Error(response?.error || 'No se pudo actualizar el Feed.')
      }
    } catch (refreshError) {
      setError(refreshError?.message || 'No se pudo actualizar el Feed.')
      setRefreshing(false)
    }
  }, [refreshing, scope])

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
      compactLayout: feedCompactLayout,
      activeTab,
      onOpenCollection: handleOpenCollection
    }),
    [activeRows, activeTab, feedCompactLayout, handleOpenCollection]
  )

  const renderRankingCards = () => (
    <div
      className={`feed-ranking-cards ${
        shouldUseCompactFeedCards ? 'feed-ranking-cards--movil' : ''
      } ${feedCompactLayout === 'horizontal' ? 'feed-ranking-cards--movil-horizontal' : ''}`.trim()}
      role="tablist"
      aria-label="Rankings de colecciones"
    >
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
            variant={shouldUseCompactFeedCards ? 'mini' : 'default'}
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
  )

  const renderBoardHeaderActions = ({ loading = false } = {}) => {
    if (loading) {
      return (
        <div className="feed-ranking-board__header-side" aria-hidden="true">
          <Skeleton width="110px" height="32px" />
          <div className="feed-ranking-board__header-actions feed-ranking-board__header-actions--skeleton">
            <Skeleton width="42px" height="42px" borderRadius="12px" />
            <Skeleton width="220px" height="42px" borderRadius="12px" />
          </div>
        </div>
      )
    }

    return (
      <div className="feed-ranking-board__header-side">
        <strong>{activeTab.formatValue(activeTotalValue, activeRows)}</strong>
        <div className="feed-ranking-board__header-actions">
          <button
            type="button"
            className={`feed-refresh-button${refreshing ? ' is-refreshing' : ''}`}
            aria-label="Actualizar Feed"
            aria-busy={refreshing}
            disabled={refreshing}
            onClick={() => void handleRefreshFeed()}
          >
            <LuRefreshCw aria-hidden="true" />
          </button>

          <div className="feed-scope-switch" role="tablist" aria-label="Filtrar colecciones">
            {SCOPE_OPTIONS.map((option) => {
              const ScopeIcon = option.icon

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === option.id}
                  className={scope === option.id ? 'is-active' : ''}
                  disabled={switchingScope}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setScope(option.id)}
                >
                  <ScopeIcon aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderRankingBoard = () => (
    <div
      className={`feed-ranking-board tone-${activeTab.tone}${
        shouldUseCompactFeedCards ? ' feed-ranking-board--movil' : ''
      }${feedCompactLayout === 'horizontal' ? ' feed-ranking-board--movil-horizontal' : ''}`}
    >
      <div className="feed-ranking-board__header">
        <div className="feed-ranking-board__header-main">
          <span>{scopeLabel}</span>
          <h2>{activeTab.boardLabel}</h2>
        </div>
        {renderBoardHeaderActions()}
      </div>

      {error ? <div className="feed-ranking-board__error">{error}</div> : null}

      {activeRows.length === 0 ? (
        <div className="feed-ranking-board__empty">No hay colecciones para este ranking.</div>
      ) : (
        <div ref={listWrapRef} className="feed-ranking-board__listWrap">
          <FixedSizeList
            className="feed-collection-list feed-collection-list--virtual"
            height={listHeight}
            itemCount={activeRows.length}
            itemData={virtualListData}
            itemKey={(index, data) => {
              const collection = data.items[index]
              return collection ? `${collection.type}:${collection.path}` : `collection-${index}`
            }}
            itemSize={feedRowHeight}
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
  )

  const renderLoadingFeed = () => (
    <section className={`${feedClassName} Feed--loading`} aria-busy="true">
      <div
        className={`feed-ranking-layout ${
          feedCompactLayout === 'horizontal' ? 'feed-ranking-layout--movil-horizontal' : ''
        }`.trim()}
      >
        <CollectionInsightsLoadingShell
          mode="library"
          cards={RANKING_TABS}
          loadingRows={6}
          loadingTitle="Directorios y Playlists"
          loadingEyebrow="Collection Feed"
          compactLayout={feedCompactLayout === 'horizontal' ? 'horizontal' : 'default'}
          cardsClassName={`feed-ranking-cards feed-ranking-cards--skeleton ${
            shouldUseCompactFeedCards ? 'feed-ranking-cards--movil' : ''
          } ${
            feedCompactLayout === 'horizontal' ? 'feed-ranking-cards--movil-horizontal' : ''
          }`.trim()}
          cardClassName={`feed-ranking-card ${
            shouldUseCompactFeedCards ? 'feed-ranking-card--movil-skeleton' : ''
          }`.trim()}
          boardClassName={`feed-ranking-board ${
            shouldUseCompactFeedCards ? 'feed-ranking-board--movil' : ''
          } ${
            feedCompactLayout === 'horizontal' ? 'feed-ranking-board--movil-horizontal' : ''
          }`.trim()}
          loadingHeaderSide={renderBoardHeaderActions({ loading: true })}
        />
      </div>
    </section>
  )

  if (loading) {
    return renderLoadingFeed()
  }

  if (error && !overview) {
    return (
      <section className={`${feedClassName} Feed--error`}>
        <div className="feed-error-message">{error}</div>
      </section>
    )
  }

  return (
    <section
      className={`${feedClassName}${switchingScope ? ' Feed--loading' : ''}`}
      aria-busy={refreshing || switchingScope}
    >
      {switchingScope ? (
        <div
          className={`feed-ranking-layout ${
            feedCompactLayout === 'horizontal' ? 'feed-ranking-layout--movil-horizontal' : ''
          }`.trim()}
        >
          <CollectionInsightsLoadingShell
            mode="library"
            cards={RANKING_TABS}
            loadingRows={6}
            loadingTitle="Directorios y Playlists"
            loadingEyebrow="Collection Feed"
            compactLayout={feedCompactLayout === 'horizontal' ? 'horizontal' : 'default'}
            cardsClassName={`feed-ranking-cards feed-ranking-cards--skeleton ${
              shouldUseCompactFeedCards ? 'feed-ranking-cards--movil' : ''
            } ${
              feedCompactLayout === 'horizontal' ? 'feed-ranking-cards--movil-horizontal' : ''
            }`.trim()}
            cardClassName={`feed-ranking-card ${
              shouldUseCompactFeedCards ? 'feed-ranking-card--movil-skeleton' : ''
            }`.trim()}
            boardClassName={`feed-ranking-board ${
              shouldUseCompactFeedCards ? 'feed-ranking-board--movil' : ''
            } ${
              feedCompactLayout === 'horizontal' ? 'feed-ranking-board--movil-horizontal' : ''
            }`.trim()}
            loadingHeaderSide={renderBoardHeaderActions({ loading: true })}
          />
        </div>
      ) : (
        <div
          className={`feed-ranking-layout ${
            feedCompactLayout === 'horizontal' ? 'feed-ranking-layout--movil-horizontal' : ''
          }`.trim()}
        >
          {renderRankingCards()}
          {renderRankingBoard()}
        </div>
      )}
    </section>
  )
}

export default Feed
