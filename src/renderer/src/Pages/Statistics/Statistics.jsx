import { useEffect, useMemo, useState } from 'react'
import { LuListMusic, LuRefreshCw } from 'react-icons/lu'
import { CollectionInsightsPanel } from '../../components/CollectionInsights/CollectionInsightsPanel'
import { buildCollectionSummaryFromTracks } from '../../components/CollectionInsights/collectionInsightsConfig'
import './Statistics.scss'

function Statistics() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true

    async function loadLibraryTracks() {
      setLoading(true)
      setError('')

      try {
        const result = await window.electron.ipcRenderer.invoke('get-all-audio-files')

        if (!alive) {
          return
        }

        if (!Array.isArray(result)) {
          setError('No se pudo cargar la biblioteca completa.')
          setTracks([])
          return
        }

        setTracks(result)
      } catch (loadError) {
        if (alive) {
          setError(loadError?.message || 'No se pudo cargar la biblioteca completa.')
          setTracks([])
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void loadLibraryTracks()

    return () => {
      alive = false
    }
  }, [])

  const summary = useMemo(() => buildCollectionSummaryFromTracks(tracks), [tracks])

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

      {tracks.length === 0 ? (
        <div className="statistics-empty">
          <div className="statistics-empty__icon">
            <LuListMusic />
          </div>
          <h2>Todavia no hay canciones en la biblioteca.</h2>
          <p>Agrega carpetas o playlists para empezar a construir tus rankings.</p>
        </div>
      ) : (
        <CollectionInsightsPanel
          tracks={tracks}
          sourceName="Estadisticas"
          mode="library"
          showAllSongsTab={false}
        />
      )}
    </section>
  )
}

export default Statistics
