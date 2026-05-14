import React, { useEffect, useState, useMemo } from 'react'
import FeedRankingRail from './components/FeedRankingRail'
import './Feed.scss'

function Feed() {
  const [rankings, setRankings] = useState({
    shortViews: [],
    longViews: [],
    duration: [],
    skips: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    
    const fetchRankings = async () => {
      try {
        setLoading(true)
        const data = await window.electron.ipcRenderer.invoke('statistics:get-rankings', { limit: 10 })
        if (isMounted && data) {
          if (data.success) {
            setRankings(data.rankings || { shortViews: [], longViews: [], duration: [], skips: [] })
          } else {
            setError(data.error || 'Error al cargar los rankings')
          }
        }
      } catch (err) {
        console.error('Failed to fetch rankings:', err)
        if (isMounted) {
          setError('Error al cargar los rankings')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRankings()

    return () => {
      isMounted = false
    }
  }, [])

  const rails = useMemo(() => [
    { id: 'shortViews', title: '10 más vistos', data: rankings.shortViews || [] },
    { id: 'longViews', title: '10 populares', data: rankings.longViews || [] },
    { id: 'duration', title: '10 con más duración acumulada', data: rankings.duration || [] },
    { id: 'skips', title: '10 más skipeados', data: rankings.skips || [] }
  ], [rankings])

  if (error) {
    return (
      <div className="Feed Feed--error">
        <div className="feed-error-message">{error}</div>
      </div>
    )
  }

  return (
    <div className="Feed">
      <div className="feed-spacer" />

      <div className="feed-bottom-content">
        {loading ? (
          <div className="feed-loading">Cargando rankings...</div>
        ) : (
          rails.map((rail) => (
            <FeedRankingRail 
              key={rail.id}
              railId={rail.id}
              title={rail.title}
              songs={rail.data}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Feed
