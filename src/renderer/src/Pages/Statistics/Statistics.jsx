import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LuListMusic } from 'react-icons/lu'
import { Bounce, toast } from 'react-toastify'

import { useQueue } from '../../Contexts/QueueContext'
import { CollectionInsightsPanel } from '../../components/CollectionInsights/CollectionInsightsPanel'
import './Statistics.scss'

const RANKING_PLAY_PAGE_SIZE = 200

function toastLoadError(message) {
  toast.error(message, {
    position: 'bottom-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: 'dark',
    transition: Bounce
  })
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

function Statistics() {
  const outletContext = useOutletContext() || {}
  const { PlayQueue, playQueueShuffled } = useQueue()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rankingLoadingTab, setRankingLoadingTab] = useState('')
  const [hydratingLibraryTracks, setHydratingLibraryTracks] = useState(false)
  const [shufflingLibrary, setShufflingLibrary] = useState(false)
  const allTracksCacheRef = useRef(null)

  useEffect(() => {
    let alive = true

    async function loadLibraryOverview() {
      setLoading(true)
      setError('')
      const startTime = performance.now()

      try {
        const result = await window.electron.ipcRenderer.invoke('statistics:get-overview', {
          pageSize: 50
        })

        if (!alive) return

        if (!result?.success) {
          setError(result?.error || 'No se pudo cargar la biblioteca completa.')
          setOverview(null)
          return
        }

        setOverview(result)
        console.info('[statistics] overview loaded', {
          tracks: result?.summary?.trackCount || 0,
          ms: Math.round(performance.now() - startTime)
        })
      } catch (loadError) {
        if (alive) {
          setError(loadError?.message || 'No se pudo cargar la biblioteca completa.')
          setOverview(null)
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void loadLibraryOverview()

    return () => {
      alive = false
    }
  }, [])

  const handleLoadMoreRanking = useCallback(async (tabId) => {
    const currentRanking = overview?.rankings?.[tabId]

    if (!currentRanking?.hasMore || rankingLoadingTab) return

    setRankingLoadingTab(tabId)

    try {
      const response = await window.electron.ipcRenderer.invoke('statistics:get-ranking-page', {
        tabId,
        page: (currentRanking.page || 1) + 1,
        pageSize: currentRanking.pageSize || 50
      })

      if (!response?.success) {
        throw new Error(response?.error || 'No se pudo cargar el ranking.')
      }

      setOverview((currentOverview) => ({
        ...currentOverview,
        rankings: {
          ...currentOverview.rankings,
          [tabId]: mergeRankingPage(currentOverview.rankings?.[tabId], response.ranking)
        }
      }))
    } catch (rankingError) {
      setError(rankingError?.message || 'No se pudo cargar el ranking.')
    } finally {
      setRankingLoadingTab('')
    }
  }, [overview?.rankings, rankingLoadingTab])

  const handlePlayRanking = useCallback(async (tabId) => {
    if (!tabId) return

    try {
      const rankingTracks = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const response = await window.electron.ipcRenderer.invoke('statistics:get-ranking-page', {
          tabId,
          page,
          pageSize: RANKING_PLAY_PAGE_SIZE
        })

        if (!response?.success) {
          throw new Error(response?.error || 'No se pudo cargar el ranking.')
        }

        const ranking = response.ranking
        const items = Array.isArray(ranking?.items) ? ranking.items : []
        rankingTracks.push(...items)
        hasMore = Boolean(ranking?.hasMore)
        page += 1
      }

      if (rankingTracks.length === 0) {
        throw new Error('This ranking has no songs to play.')
      }

      playQueueShuffled(rankingTracks, `statistics:${tabId}`)
    } catch (rankingError) {
      toastLoadError(rankingError?.message || 'No se pudo reproducir el ranking.')
    }
  }, [playQueueShuffled])

  const loadAllLibraryTracks = useCallback(async () => {
    if (allTracksCacheRef.current) {
      return allTracksCacheRef.current
    }

    setHydratingLibraryTracks(true)

    try {
      const tracks = await window.electron.ipcRenderer.invoke('get-all-audio-files')
      const normalizedTracks = Array.isArray(tracks) ? tracks : []
      allTracksCacheRef.current = normalizedTracks
      return normalizedTracks
    } catch (loadError) {
      throw new Error(loadError?.message || 'No se pudo cargar la biblioteca completa.')
    } finally {
      setHydratingLibraryTracks(false)
    }
  }, [])

  const summary = overview?.summary || {
    trackCount: 0
  }

  const handlePlayLibraryShuffled = useCallback(async () => {
    if ((summary.trackCount || 0) === 0 || shufflingLibrary) return

    setShufflingLibrary(true)

    try {
      const tracks = await loadAllLibraryTracks()

      if (tracks.length === 0) {
        return
      }

      playQueueShuffled(tracks, 'statistics')
    } catch (shuffleError) {
      toastLoadError(shuffleError?.message || 'No se pudo reproducir la biblioteca en aleatorio.')
    } finally {
      setShufflingLibrary(false)
    }
  }, [loadAllLibraryTracks, playQueueShuffled, shufflingLibrary, summary.trackCount])
  const shouldUseHorizontalCollectionLayout = Boolean(
    outletContext.shouldUseCollectionHorizontalMobileLayout
  )
  const shouldUseMobileCollectionLayout = Boolean(outletContext.shouldUseCollectionMobileLayout)
  const collectionCompactLayout = shouldUseHorizontalCollectionLayout
    ? 'horizontal'
    : shouldUseMobileCollectionLayout
      ? 'vertical'
      : 'default'
  const statisticsPageClassName = `statistics-page ${
    collectionCompactLayout === 'vertical' ? 'statistics-page--movil' : ''
  } ${
    collectionCompactLayout === 'horizontal' ? 'statistics-page--movil-horizontal' : ''
  }`.trim()

  if (loading) {
    return (
      <section className={`${statisticsPageClassName} statistics-page--loading`}>
        <CollectionInsightsPanel
          loading
          mode="library"
          compactLayout={collectionCompactLayout}
          loadingActionCount={1}
          showAllSongsTab={false}
          loadingRows={5}
          loadingTitle="Biblioteca completa"
          loadingEyebrow="Biblioteca global"
        />
      </section>
    )
  }

  if (error) {
    return (
      <section className={statisticsPageClassName}>
        <div className="statistics-error">{error}</div>
      </section>
    )
  }

  return (
    <section className={statisticsPageClassName}>
      <CollectionInsightsPanel
        rankings={overview.rankings}
        totalTrackCount={summary.trackCount || 0}
        sourceName="Estadisticas"
        mode="library"
        showAllSongsTab={false}
        rankingLoadingTab={rankingLoadingTab}
        compactLayout={collectionCompactLayout}
        onPlayCollectionShuffled={handlePlayLibraryShuffled}
        shuffleActionDisabled={summary.trackCount === 0 || hydratingLibraryTracks}
        shuffleActionLoading={shufflingLibrary}
        shuffleActionLabel="Play the full library shuffled"
        onLoadMoreRanking={handleLoadMoreRanking}
        onPlayRanking={handlePlayRanking}
        isEmptyCollection={summary.trackCount === 0}
        emptyCollectionType="statistics"
      />
    </section>
  )
}

export default Statistics
