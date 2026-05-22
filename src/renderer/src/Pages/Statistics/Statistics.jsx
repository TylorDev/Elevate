import { useCallback, useEffect, useState } from 'react'
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
  const { PlayQueue } = useQueue()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rankingLoadingTab, setRankingLoadingTab] = useState('')

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
        throw new Error('Este ranking no tiene canciones para reproducir.')
      }

      PlayQueue(rankingTracks, `statistics:${tabId}`, 0)
    } catch (rankingError) {
      toastLoadError(rankingError?.message || 'No se pudo reproducir el ranking.')
    }
  }, [PlayQueue])

  const summary = overview?.summary || {
    trackCount: 0
  }

  if (loading) {
    return (
      <section className="statistics-page statistics-page--loading">
        <CollectionInsightsPanel
          loading
          mode="library"
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
      <section className="statistics-page">
        <div className="statistics-error">{error}</div>
      </section>
    )
  }

  return (
    <section className="statistics-page">
      {summary.trackCount === 0 ? (
        <div className="statistics-empty">
          <div className="statistics-empty__icon">
            <LuListMusic />
          </div>
          <h2>Todavia no hay canciones en la biblioteca.</h2>
          <p>Agrega carpetas o playlists para empezar a construir tus rankings.</p>
        </div>
      ) : (
        <CollectionInsightsPanel
          rankings={overview.rankings}
          totalTrackCount={summary.trackCount || 0}
          sourceName="Estadisticas"
          mode="library"
          showAllSongsTab={false}
          rankingLoadingTab={rankingLoadingTab}
          onLoadMoreRanking={handleLoadMoreRanking}
          onPlayRanking={handlePlayRanking}
        />
      )}
    </section>
  )
}

export default Statistics
