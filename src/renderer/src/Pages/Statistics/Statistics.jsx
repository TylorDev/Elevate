import { useCallback, useEffect, useState } from 'react'
import { LuListMusic, LuRefreshCw } from 'react-icons/lu'
import { CollectionInsightsPanel } from '../../components/CollectionInsights/CollectionInsightsPanel'
import './Statistics.scss'

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

  const summary = overview?.summary || {
    trackCount: 0
  }

  if (loading) {
    return (
      <section className="statistics-page statistics-page--loading">
        <div className="statistics-loading">
          <LuRefreshCw />
          Cargando estadisticas...
        </div>
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
      <header className="statistics-hero">
        <div className="statistics-hero__copy">
          <span className="statistics-kicker">Playback telemetry</span>
          <h1>Estadisticas</h1>
          <p>
            La misma consola de coleccion, pero agregada sobre toda la biblioteca del usuario.
          </p>
        </div>

        <div className="statistics-hero__signal">
          <span>{summary.trackCount || 0}</span>
          <small>tracks en biblioteca</small>
        </div>
      </header>

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
        />
      )}
    </section>
  )
}

export default Statistics
