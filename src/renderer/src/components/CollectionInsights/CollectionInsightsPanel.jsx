import { useEffect, useMemo, useState } from 'react'
import { Cola } from '../Cola/Cola'
import {
  COLLECTION_INSIGHT_CARD_TABS,
  COLLECTION_INSIGHT_TABS,
  buildCollectionRankings,
  formatMetricValue,
  getInsightAggregateValue,
  getInsightTrackValueLabel
} from './collectionInsightsConfig'
import './CollectionInsightsPanel.scss'

const DEFAULT_LIST_HEIGHT = 320
const VIEWPORT_OFFSET = 390

function getListHeight() {
  return Math.max(window.innerHeight - VIEWPORT_OFFSET, DEFAULT_LIST_HEIGHT)
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
  showAllSongsTab = true,
  onLoadMoreRanking,
  rankingLoadingTab = ''
}) {
  const defaultTabId = showAllSongsTab ? 'allSongs' : COLLECTION_INSIGHT_CARD_TABS[0]?.id || 'allSongs'
  const [activeTabId, setActiveTabId] = useState(defaultTabId)
  const [listHeight, setListHeight] = useState(() => getListHeight())

  useEffect(() => {
    const handleResize = () => {
      setListHeight(getListHeight())
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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
  const activeHasMore = Boolean(activeRanking?.hasMore)
  const isActiveRankingLoading = rankingLoadingTab === activeTab.id
  const visibleTrackCount = Number.isFinite(totalTrackCount) ? totalTrackCount : tracks.length

  return (
    <section className={`collection-insights collection-insights--${mode}`}>
      <div className="collection-insights__cards" role="tablist" aria-label="Rankings de coleccion">
        {COLLECTION_INSIGHT_CARD_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab.id === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`collection-insights__card tone-${tab.tone} ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="collection-insights__card-icon">
                <Icon />
              </span>
              <span className="collection-insights__card-label">{tab.summaryLabel}</span>
              <strong className="collection-insights__card-value">
                {tab.formatValue(cardTotals[tab.id])}
              </strong>
            </button>
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

      <div className={`collection-insights__board tone-${activeTab.tone}`}>
        <div className="collection-insights__board-header">
          <div>
            <span>{mode === 'library' ? 'Biblioteca global' : 'Ranking activo'}</span>
            <h2>{activeTab.boardLabel}</h2>
          </div>
          <strong>{activeTab.formatValue(aggregateValue, activeRows)}</strong>
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
            rowHeight={72}
            height={listHeight}
            hasMore={activeHasMore}
            isLoading={isActiveRankingLoading}
            onLoadMore={() => onLoadMoreRanking?.(activeTab.id)}
            insightMode={activeTab.id !== 'allSongs'}
            insightValueResolver={(track) => getInsightTrackValueLabel(activeTab, track)}
          />
        )}
      </div>

      <div className="collection-insights__footer">
        <span>{activeRows.length} tracks visibles</span>
        <span>{formatMetricValue(visibleTrackCount)} tracks en la coleccion</span>
      </div>
    </section>
  )
}

export default CollectionInsightsPanel
