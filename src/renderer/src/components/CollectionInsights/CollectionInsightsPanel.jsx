import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuLoaderCircle, LuPlay } from 'react-icons/lu'
import { Cola } from '../Cola/Cola'
import { useSongCover, DEFAULT_COVER } from '../../Contexts/ImagesContext'
import { useDominantColor } from '../../utils/useDominantColor'
import {
  COLLECTION_INSIGHT_CARD_TABS,
  COLLECTION_INSIGHT_TABS,
  buildCollectionRankings,
  formatMetricValue,
  getInsightAggregateValue,
  getInsightTrackValueLabel
} from './collectionInsightsConfig'
import { CollectionCard } from '../CollectionCard/CollectionCard'
import './CollectionInsightsPanel.scss'

const DEFAULT_LIST_HEIGHT = 320
const VIEWPORT_OFFSET = 390
const INSIGHT_ROW_HEIGHT = 72

function getListHeight() {
  return Math.max(window.innerHeight - VIEWPORT_OFFSET, DEFAULT_LIST_HEIGHT)
}

function CollectionInsightCard({
  tab,
  totalValue,
  totalTracks,
  isActive,
  onClick,
  onPlay,
  playDisabled,
  playLoading,
  mode,
  collectionCoverUrl
}) {
  const Icon = tab.icon
  const topTrack = Array.isArray(tab.rows) ? tab.rows[0] : null
  const coverUrl = useSongCover(topTrack?.filePath, 'thumb')
  const rankingCoverUrl =
    coverUrl && coverUrl !== DEFAULT_COVER && !coverUrl.includes('svg') ? coverUrl : ''
  const shouldUseCollectionCover =
    mode === 'collection' && tab.id === 'duration' && Boolean(collectionCoverUrl)
  const backgroundImage = shouldUseCollectionCover ? collectionCoverUrl : rankingCoverUrl
  const dominantColor = useDominantColor(backgroundImage)

  return (
    <CollectionCard
      as="button"
      role="tab"
      aria-selected={isActive}
      tone={tab.tone}
      active={isActive}
      interactive
      icon={<Icon />}
      label={tab.summaryLabel}
      value={tab.formatValue(totalValue)}
      meta={`Tracks: ${formatMetricValue(totalTracks)}`}
      className="collection-insights__card"
      backgroundImage={backgroundImage}
      accentColor={backgroundImage ? dominantColor.hex : ''}
      accentContrastColor={backgroundImage ? dominantColor.contrastHex : ''}
      actionIcon={playLoading ? <LuLoaderCircle /> : <LuPlay />}
      actionLabel={`Reproducir ranking ${tab.summaryLabel}`}
      actionDisabled={playDisabled}
      actionLoading={playLoading}
      onActionClick={onPlay || undefined}
      onClick={onClick}
    />
  )
}

function EmptyState({ label }) {
  return (
    <div className="collection-insights__empty">
      <h2>Sin datos para este ranking.</h2>
      <p>{label} aparecera aqui cuando la coleccion tenga reproducciones registradas.</p>
    </div>
  )
}

export function CollectionInsightsPanel({
  tracks = [],
  rankings: providedRankings = null,
  totalTrackCount,
  sourceName,
  mode = 'collection',
  collectionCoverUrl = '',
  collectionDisplayName = '',
  sourceTypeLabel = '',
  headerActions = null,
  showAllSongsTab = true,
  visibleRows,
  onLoadMoreRanking,
  onPlayRanking,
  rankingLoadingTab = ''
}) {
  const defaultTabId = showAllSongsTab ? 'allSongs' : COLLECTION_INSIGHT_CARD_TABS[0]?.id || 'allSongs'
  const hasFixedVisibleRows = Number.isFinite(visibleRows) && visibleRows > 0
  const shouldFillPanelHeight = mode === 'library'
  const [activeTabId, setActiveTabId] = useState(defaultTabId)
  const [playingRankingTabId, setPlayingRankingTabId] = useState('')
  const [listHeight, setListHeight] = useState(() =>
    hasFixedVisibleRows ? visibleRows * INSIGHT_ROW_HEIGHT : getListHeight()
  )

  useEffect(() => {
    if (hasFixedVisibleRows) {
      setListHeight(visibleRows * INSIGHT_ROW_HEIGHT)
      return undefined
    }

    const handleResize = () => {
      setListHeight(getListHeight())
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hasFixedVisibleRows, visibleRows])

  useEffect(() => {
    if (!showAllSongsTab && activeTabId === 'allSongs') {
      setActiveTabId(COLLECTION_INSIGHT_CARD_TABS[0]?.id || 'allSongs')
    }
  }, [activeTabId, showAllSongsTab])

  const fallbackRankings = useMemo(
    () => (providedRankings ? null : buildCollectionRankings(tracks)),
    [providedRankings, tracks]
  )
  const rankings = providedRankings || fallbackRankings || {}
  const activeTab = useMemo(
    () => COLLECTION_INSIGHT_TABS.find((tab) => tab.id === activeTabId) || COLLECTION_INSIGHT_TABS[0],
    [activeTabId]
  )
  const activeRanking = rankings[activeTab.id]
  const activeRows = Array.isArray(activeRanking?.items)
    ? activeRanking.items
    : Array.isArray(activeRanking)
      ? activeRanking
      : []
  const activeTopTrack = activeRows[0]
  const activeBoardCoverUrl = useSongCover(activeTopTrack?.filePath, 'thumb')
  const activeBoardDominantColor = useDominantColor(
    activeBoardCoverUrl && activeBoardCoverUrl !== DEFAULT_COVER && !activeBoardCoverUrl.includes('svg')
      ? activeBoardCoverUrl
      : ''
  )
  const aggregateValue =
    activeTab.id === 'allSongs' || !activeRanking?.totalValue
      ? getInsightAggregateValue(activeTab, activeRows)
      : activeRanking.totalValue
  const cardTotals = useMemo(
    () =>
      COLLECTION_INSIGHT_CARD_TABS.reduce((totals, tab) => {
        const ranking = rankings[tab.id]
        const rows = Array.isArray(ranking?.items) ? ranking.items : Array.isArray(ranking) ? ranking : []
        totals[tab.id] = ranking?.totalValue ?? getInsightAggregateValue(tab, rows)
        return totals
      }, {}),
    [rankings]
  )
  const cardRows = useMemo(
    () =>
      COLLECTION_INSIGHT_CARD_TABS.reduce((totals, tab) => {
        const ranking = rankings[tab.id]
        totals[tab.id] = Array.isArray(ranking?.items)
          ? ranking.items
          : Array.isArray(ranking)
            ? ranking
            : []
        return totals
      }, {}),
    [rankings]
  )
  const cardTrackTotals = useMemo(
    () =>
      COLLECTION_INSIGHT_CARD_TABS.reduce((totals, tab) => {
        const ranking = rankings[tab.id]
        const rows = Array.isArray(ranking?.items)
          ? ranking.items
          : Array.isArray(ranking)
            ? ranking
            : []
        const total = Number(ranking?.total)
        totals[tab.id] = Number.isFinite(total) ? total : rows.length
        return totals
      }, {}),
    [rankings]
  )
  const activeHasMore = Boolean(activeRanking?.hasMore)
  const isActiveRankingLoading = rankingLoadingTab === activeTab.id
  const visibleTrackCount = Number.isFinite(totalTrackCount) ? totalTrackCount : tracks.length
  const shouldShowCollectionHeader = mode === 'collection' && activeTab.id === 'duration'
  const boardEyebrow = shouldShowCollectionHeader
    ? sourceTypeLabel || 'Ranking activo'
    : mode === 'library'
      ? 'Biblioteca global'
      : 'Ranking activo'
  const boardTitle = shouldShowCollectionHeader
    ? collectionDisplayName || activeTab.boardLabel
    : activeTab.boardLabel
  const handlePlayRanking = useCallback(
    async (tabId) => {
      if (!onPlayRanking || playingRankingTabId) return

      setPlayingRankingTabId(tabId)

      try {
        await onPlayRanking(tabId)
      } finally {
        setPlayingRankingTabId('')
      }
    },
    [onPlayRanking, playingRankingTabId]
  )

  return (
    <section className={`collection-insights collection-insights--${mode}`}>
      <div className="collection-insights__cards" role="tablist" aria-label="Rankings de coleccion">
        {COLLECTION_INSIGHT_CARD_TABS.map((tab) => {
          const isActive = activeTab.id === tab.id

          return (
            <CollectionInsightCard
              key={tab.id}
              tab={{ ...tab, rows: cardRows[tab.id] }}
              totalValue={cardTotals[tab.id]}
              totalTracks={cardTrackTotals[tab.id]}
              isActive={isActive}
              mode={mode}
              collectionCoverUrl={collectionCoverUrl}
              playDisabled={!onPlayRanking || !cardRows[tab.id]?.length || Boolean(playingRankingTabId)}
              playLoading={playingRankingTabId === tab.id}
              onPlay={onPlayRanking ? () => void handlePlayRanking(tab.id) : undefined}
              onClick={() => setActiveTabId(tab.id)}
            />
          )
        })}
      </div>

      {showAllSongsTab ? (
        <div className="collection-insights__secondary-tabs" role="tablist" aria-label="Listados">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.id === 'allSongs'}
            className={activeTab.id === 'allSongs' ? 'is-active' : ''}
            onClick={() => setActiveTabId('allSongs')}
          >
            All Songs
          </button>
        </div>
      ) : null}

      <div
        className={`collection-insights__board tone-${activeTab.tone}`}
        style={{
          '--board-color': activeBoardDominantColor.hex
        }}
      >
        <div className="collection-insights__board-header">
          <div className="collection-insights__board-header-main">
            <span>{boardEyebrow}</span>
            <h2>{boardTitle}</h2>
          </div>
          <div className="collection-insights__board-header-side">
            <strong>{activeTab.formatValue(aggregateValue, activeRows)}</strong>
            {headerActions ? (
              <div className="collection-insights__board-actions">{headerActions}</div>
            ) : null}
          </div>
        </div>

        {activeRows.length === 0 ? (
          <EmptyState label={activeTab.boardLabel} />
        ) : (
          <Cola
            list={activeRows}
            name={sourceName}
            preserveOrder
            virtualized
            virtualizationThreshold={20}
            rowHeight={INSIGHT_ROW_HEIGHT}
            height={shouldFillPanelHeight ? '100%' : listHeight}
            hasMore={activeHasMore}
            isLoading={isActiveRankingLoading}
            onLoadMore={() => onLoadMoreRanking?.(activeTab.id)}
            insightMode={activeTab.id !== 'allSongs'}
            insightValueResolver={(track) => getInsightTrackValueLabel(activeTab, track)}
          />
        )}
      </div>


    </section>
  )
}

export default CollectionInsightsPanel
