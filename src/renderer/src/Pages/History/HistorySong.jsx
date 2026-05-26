import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  LuArrowLeft,
  LuCalendarDays,
  LuChartLine,
  LuClock3,
  LuDisc3,
  LuRefreshCw,
  LuTrophy
} from 'react-icons/lu'
import { useSongCover } from '../../Contexts/ImagesContext'
import { useI18n } from '../../Contexts/I18nContext'
import './HistorySong.scss'

function safeDecodeParam(value = '') {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function formatDateTime(value, t) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t ? t('historySong.noDate') : 'Sin fecha'
  }

  return new Intl.DateTimeFormat(navigator.language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatDay(value, t) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return t ? t('historySong.noDate') : 'Sin fecha'
  }

  return new Intl.DateTimeFormat(navigator.language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function buildChartGeometry(records = []) {
  const width = 720
  const height = 220
  const padding = {
    top: 22,
    right: 24,
    bottom: 42,
    left: 34
  }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxCount = Math.max(...records.map((record) => record.count), 1)
  const step = records.length > 1 ? plotWidth / (records.length - 1) : 0
  const barWidth = Math.max(5, Math.min(34, records.length > 1 ? step * 0.44 : 42))

  const points = records.map((record, index) => {
    const x = records.length > 1 ? padding.left + step * index : padding.left + plotWidth / 2
    const y = padding.top + plotHeight - (record.count / maxCount) * plotHeight
    const barHeight = (record.count / maxCount) * plotHeight

    return {
      ...record,
      x,
      y,
      barX: x - barWidth / 2,
      barY: padding.top + plotHeight - barHeight,
      barWidth,
      barHeight
    }
  })

  return {
    width,
    height,
    padding,
    plotHeight,
    points,
    linePoints: points.map((point) => `${point.x},${point.y}`).join(' '),
    areaPoints:
      points.length > 0
        ? [
            `${points[0].x},${padding.top + plotHeight}`,
            ...points.map((point) => `${point.x},${point.y}`),
            `${points[points.length - 1].x},${padding.top + plotHeight}`
          ].join(' ')
        : ''
  }
}

function HistoryChart({ records = [], t }) {
  const geometry = useMemo(() => buildChartGeometry(records), [records])
  const [activePoint, setActivePoint] = useState(null)

  if (records.length === 0) {
    return (
      <div className="history-song-chart history-song-chart--empty">
        <LuChartLine />
        <span>{t('historySong.notEnoughRecords')}</span>
      </div>
    )
  }

  const firstDay = records[0]?.date
  const lastDay = records[records.length - 1]?.date
  const handlePointHover = (point) => {
    setActivePoint(point)
  }

  const handlePointLeave = () => {
    setActivePoint(null)
  }

  return (
    <div className="history-song-chart" aria-label={t('historySong.chartAria')}>
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img">
        <defs>
          <linearGradient id="historySongArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          className="history-song-chart__axis"
          x1={geometry.padding.left}
          x2={geometry.width - geometry.padding.right}
          y1={geometry.padding.top + geometry.plotHeight}
          y2={geometry.padding.top + geometry.plotHeight}
        />

        {geometry.points.map((point) => (
          <g
            key={point.date}
            className={activePoint?.date === point.date ? 'is-active' : undefined}
            onMouseEnter={() => handlePointHover(point)}
            onMouseMove={() => handlePointHover(point)}
            onMouseLeave={handlePointLeave}
          >
            <rect
              className="history-song-chart__bar"
              x={point.barX}
              y={point.barY}
              width={point.barWidth}
              height={Math.max(point.barHeight, 2)}
              rx="2"
            />
            <circle className="history-song-chart__dot" cx={point.x} cy={point.y} r="4" />
            <rect
              className="history-song-chart__hit-area"
              x={point.barX - 8}
              y={Math.max(point.y - 18, 0)}
              width={point.barWidth + 16}
              height={geometry.padding.top + geometry.plotHeight - Math.max(point.y - 18, 0)}
              rx="8"
            />
          </g>
        ))}

        {geometry.areaPoints ? (
          <polygon className="history-song-chart__area" points={geometry.areaPoints} />
        ) : null}
        <polyline className="history-song-chart__line" points={geometry.linePoints} />
      </svg>

      {activePoint ? (
        <div
          className="history-song-chart__tooltip"
          style={{
            left: `${(activePoint.x / geometry.width) * 100}%`,
            top: `${Math.max(((activePoint.y - 16) / geometry.height) * 100, 4)}%`
          }}
        >
          <strong>{activePoint.count}</strong>
          <span>{formatDay(activePoint.date, t)}</span>
        </div>
      ) : null}

      <div className="history-song-chart__labels">
        <span>{formatDay(firstDay, t)}</span>
        <span>{formatDay(lastDay, t)}</span>
      </div>
    </div>
  )
}

function StatTile({ icon, label, value }) {
  return (
    <div className="history-song-stat">
      <div className="history-song-stat__icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function HistorySong() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const filePath = useMemo(() => safeDecodeParam(params.filePath), [params.filePath])
  const [timeline, setTimeline] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const coverUrl = useSongCover(timeline?.song?.filePath, 'full')
  const handleGoBack = useCallback(() => {
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1)
      return
    }

    navigate('/history', { replace: true })
  }, [location.key, navigate])

  useEffect(() => {
    let alive = true

    async function loadTimeline() {
      setIsLoading(true)
      setError('')

      try {
        const response = await window.electron.ipcRenderer.invoke('history:get-song-timeline', {
          filePath
        })

        if (!alive) {
          return
        }

        if (!response?.success) {
          setTimeline(null)
          setError(response?.error || t('historySong.loadFailed'))
          return
        }

        setTimeline(response)
      } catch (loadError) {
        if (alive) {
          setTimeline(null)
          setError(loadError?.message || t('historySong.loadFailed'))
        }
      } finally {
        if (alive) {
          setIsLoading(false)
        }
      }
    }

    void loadTimeline()

    return () => {
      alive = false
    }
  }, [filePath])

  const song = timeline?.song
  const title = song?.title || song?.fileName || t('historySong.unknownSong')
  const artist = song?.artist || t('historySong.unknownArtist')
  const dailyRecords = Array.isArray(timeline?.dailyRecords) ? timeline.dailyRecords : []
  const events = Array.isArray(timeline?.events) ? timeline.events : []
  const timelineEntries = useMemo(
    () => [
      {
        id: 'library-added',
        label: t('historySong.addedToLibrary'),
        timestamp: timeline?.libraryAddedAt
      },
      ...events.map((timestamp, index) => ({
        id: `${timestamp}-${index}`,
        label: t('historySong.recordNum', { num: index + 1 }),
        timestamp
      }))
    ].filter((entry) => entry.timestamp),
    [events, timeline?.libraryAddedAt, t]
  )

  if (isLoading) {
    return (
      <section className="HistorySongPage HistorySongPage--centered">
        <div className="history-song-loading">
          <LuRefreshCw />
          {t('historySong.loading')}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="HistorySongPage HistorySongPage--centered">
        <div className="history-song-error">
          <LuDisc3 />
          <h1>{t('historySong.openFailed')}</h1>
          <p>{error}</p>
          <button type="button" onClick={handleGoBack}>
            <LuArrowLeft />
            {t('historySong.backToHistory')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="HistorySongPage">
      <header className="history-song-hero">
        <button
          type="button"
          className="history-song-back"
          onClick={handleGoBack}
          aria-label={t('historySong.backToHistory')}
          title={t('historySong.backToHistory')}
        >
          <LuArrowLeft />
        </button>

        <img className="history-song-cover" src={coverUrl} alt="" />

        <div className="history-song-title">
          <span>{t('historySong.songHistory')}</span>
          <h1>{title}</h1>
          <p>{artist}</p>
        </div>
      </header>

      <div className="history-song-stats" aria-label={t('historySong.songHistory')}>
        <StatTile
          icon={<LuChartLine />}
          label={t('historySong.records')}
          value={timeline.totalRecords || 0}
        />
        <StatTile
          icon={<LuCalendarDays />}
          label={t('historySong.inLibrary')}
          value={formatDateTime(timeline.libraryAddedAt, t)}
        />
        <StatTile
          icon={<LuClock3 />}
          label={t('historySong.lastTime')}
          value={timeline.lastPlayedAt ? formatDateTime(timeline.lastPlayedAt, t) : t('historySong.noRecords')}
        />
        <StatTile
          icon={<LuTrophy />}
          label={t('historySong.highestDay')}
          value={
            timeline.peakDay
              ? `${formatDay(timeline.peakDay.date, t)} (${timeline.peakDay.count})`
              : t('historySong.noRecords')
          }
        />
      </div>

      <main className="history-song-layout">
        <section className="history-song-panel history-song-panel--chart">
          <div className="history-song-panel__header">
            <div>
              <span>{t('historySong.historicalRecord')}</span>
              <h2>{t('historySong.playsPerDay')}</h2>
            </div>
            <strong>{t('historySong.days', { count: dailyRecords.length })}</strong>
          </div>
          <HistoryChart records={dailyRecords} t={t} />
        </section>

        <section className="history-song-panel history-song-panel--timeline">
          <div className="history-song-panel__header">
            <div>
              <span>{t('historySong.timeline')}</span>
              <h2>{t('historySong.sinceLibrary')}</h2>
            </div>
            <strong>{timelineEntries.length}</strong>
          </div>

          {timelineEntries.length > 0 ? (
            <ol className="history-song-timeline">
              {timelineEntries.map((entry) => (
                <li key={entry.id}>
                  <span className="history-song-timeline__marker" />
                  <div>
                    <strong>{entry.label}</strong>
                    <span>{formatDateTime(entry.timestamp, t)}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="history-song-empty">{t('historySong.noEventsYet')}</div>
          )}
        </section>
      </main>
    </section>
  )
}

export default HistorySong
