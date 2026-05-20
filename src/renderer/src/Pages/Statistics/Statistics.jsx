import { useEffect, useMemo, useState } from 'react'
import {
  LuClock3,
  LuEye,
  LuRefreshCw,
  LuRepeat2,
  LuSkipForward,
  LuTrophy
} from 'react-icons/lu'

import { useCoverUrl } from '../../hooks/useCoverUrl'
import { useQueue } from '../../Contexts/QueueContext'
import './Statistics.scss'

const TABS = [
  {
    id: 'shortViews',
    label: 'Mas vistos (cortas)',
    metric: 'short_view_count',
    icon: LuEye,
    tone: 'acid'
  },
  {
    id: 'longViews',
    label: 'Populares (Vistas Largas)',
    metric: 'long_view_count',
    icon: LuTrophy,
    tone: 'gold'
  },
  {
    id: 'duration',
    label: 'Top Duracion',
    metric: 'long_play_seconds',
    icon: LuClock3,
    tone: 'blue'
  },
  {
    id: 'repeats',
    label: 'Top Repeticiones',
    metric: 'consecutive_repeat_count',
    icon: LuRepeat2,
    tone: 'rose'
  },
  {
    id: 'skips',
    label: 'Top Skips',
    metric: 'skip_count',
    icon: LuSkipForward,
    tone: 'ash'
  }
]

function formatHours(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0)
  const hours = totalSeconds / 3600

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }

  return `${Math.round(totalSeconds / 60)} min`
}

function formatMetric(song, metric) {
  if (metric === 'long_play_seconds') {
    return formatHours(song.long_play_seconds)
  }

  return new Intl.NumberFormat('es').format(Number(song[metric]) || 0)
}

function StatRow({ song, index, metric, tabTone, list }) {
  const coverUrl = useCoverUrl(song.filePath, 'thumb')
  const { handleSongClick } = useQueue()
  const title = song.title || song.fileName || 'Untitled'
  const artist = song.artist || 'Unknown Artist'

  return (
    <button
      className="stat-row"
      style={{ '--stagger': `${Math.min(index, 10) * 45}ms` }}
      onClick={() => handleSongClick(song, index, list, 'Estadisticas')}
    >
      <span className={`stat-row__rank stat-row__rank--${tabTone}`}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <img className="stat-row__cover" src={coverUrl} alt="" />
      <span className="stat-row__identity">
        <span className="stat-row__title">{title}</span>
        <span className="stat-row__artist">{artist}</span>
      </span>
      <span className="stat-row__metric">{formatMetric(song, metric)}</span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="statistics-empty">
      <div className="statistics-empty__orb" />
      <h2>Todavia no hay datos para este ranking.</h2>
      <p>Reproduce algunas canciones y esta consola empezara a tomar forma.</p>
    </div>
  )
}

function Statistics() {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id)
  const [rankings, setRankings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeTab = useMemo(
    () => TABS.find((tab) => tab.id === activeTabId) || TABS[0],
    [activeTabId]
  )
  const activeRows = rankings?.[activeTab.id] || []
  const totalSignal = activeRows.reduce(
    (total, song) => total + (Number(song[activeTab.metric]) || 0),
    0
  )

  useEffect(() => {
    let alive = true

    async function loadRankings() {
      setLoading(true)
      setError('')

      try {
        const result = await window.electron.ipcRenderer.invoke('statistics:get-rankings', {
          limit: 50
        })

        if (!alive) {
          return
        }

        if (!result?.success) {
          setError(result?.error || 'No se pudieron cargar las estadisticas.')
          return
        }

        setRankings(result.rankings || {})
      } catch (loadError) {
        if (alive) {
          setError(loadError?.message || 'No se pudieron cargar las estadisticas.')
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    loadRankings()

    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="statistics-page">
      <header className="statistics-hero">
        <div>
          <span className="statistics-kicker">Playback telemetry</span>
          <h1>Estadisticas</h1>
          <p>
            Una cabina de control para ver que canciones se quedan, cuales se
            saltan y donde se acumula el tiempo real de escucha larga.
          </p>
        </div>
        <div className="statistics-hero__signal">
          <span>{activeRows.length}</span>
          <small>tracks en ranking</small>
        </div>
      </header>

      <nav className="statistics-tabs" aria-label="Rankings de canciones">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={`statistics-tab statistics-tab--${tab.tone} ${
                activeTab.id === tab.id ? 'is-active' : ''
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <Icon />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className={`statistics-board statistics-board--${activeTab.tone}`}>
        <div className="statistics-board__header">
          <div>
            <span>Ranking activo</span>
            <h2>{activeTab.label}</h2>
          </div>
          <strong>
            {activeTab.metric === 'long_play_seconds'
              ? formatHours(totalSignal)
              : new Intl.NumberFormat('es').format(totalSignal)}
          </strong>
        </div>

        {loading ? (
          <div className="statistics-loading">
            <LuRefreshCw />
            Cargando estadisticas...
          </div>
        ) : error ? (
          <div className="statistics-error">{error}</div>
        ) : activeRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="statistics-list">
            {activeRows.map((song, index) => (
              <StatRow
                key={`${activeTab.id}-${song.filePath}`}
                song={song}
                index={index}
                metric={activeTab.metric}
                tabTone={activeTab.tone}
                list={activeRows}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default Statistics
