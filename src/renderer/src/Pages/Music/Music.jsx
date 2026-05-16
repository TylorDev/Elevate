import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { FixedSizeList } from 'react-window'
import './Music.scss'

import Render from '../../components/Render/Render'
import RenderControls from '../../components/Render/RenderControls'
import {
  normalizePlaybackSource,
  useVisualizerPresets
} from '../../components/Render/useVisualizerPresets'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { useNavigate } from 'react-router-dom'
import {
  LuHeart,
  LuHeartOff,
  LuImage,
  LuActivity,
  LuSettings,
  LuPlay,
  LuLayoutGrid
} from 'react-icons/lu'

const PRESET_PREVIEW_ROW_HEIGHT = 48

function formatListeningHours(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0)
  const hours = totalSeconds / 3600

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }

  return `${Math.round(totalSeconds / 60)} min`
}

function Music() {
  const navigate = useNavigate()
  const { mediaRef, currentFile, togglePlayPause, queueState } = useSuper()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const [audioEl, setAudioEl] = useState(null)

  // Toggles de la UI
  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [autoMode, setAutoMode] = useState(true)

  const [showControls, setShowControls] = useState(false)
  const idleTimer = useRef(null)
  const presetPreviewListRef = useRef(null)

  const activePlaybackSource = useMemo(
    () => normalizePlaybackSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const presetControls = useVisualizerPresets({ activePlaybackSource })

  // [P6] Ref to track current showControls state without causing re-renders.
  // handleMouseMove only calls setState when transitioning from hidden → visible.
  const showControlsRef = useRef(showControls)
  showControlsRef.current = showControls

  // [P8] Sincronizar el autoMode con la lógica de presets.
  // Fixed: added isPresetPaused and togglePresetPause to deps to avoid stale closures.
  useEffect(() => {
    const shouldBePaused = !autoMode
    if (presetControls.isPresetPaused !== shouldBePaused) {
      presetControls.togglePresetPause()
    }
  }, [autoMode, presetControls.isPresetPaused, presetControls.togglePresetPause])

  // [P6] Memoized mouse handler — uses ref guard to avoid calling setState
  // when showControls is already true. Prevents 30-60 re-renders/sec during mouse movement.
  const handleMouseMove = useCallback(() => {
    if (!showControlsRef.current) {
      setShowControls(true)
    }
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setShowControls(false)
    }, 10000)
  }, [])

  // [P11] Stable callback — no deps needed thanks to functional setState.
  const handleMouseLeave = useCallback(() => {
    setShowControls(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }, [])

  // [P10] Simplified mediaRef sync — mediaRef is a useRef, its identity never changes.
  // Only runs once on mount to capture the audio element.
  useEffect(() => {
    if (mediaRef?.current) {
      setAudioEl(mediaRef.current)
    }
  }, [mediaRef])

  // Cleanup idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  // [P9] Memoized like handler — avoids recreation on every render.
  const handleLikeClick = useCallback(
    (event) => {
      event.stopPropagation()
      if (currentFile) {
        toggleLike(currentFile)
      }
    },
    [currentFile, toggleLike]
  )

  const handleBackgroundClick = useCallback(
    (event) => {
      if (event.target instanceof Element && event.target.closest('button')) {
        return
      }

      togglePlayPause()
    },
    [togglePlayPause]
  )

  // [P11] Stable toggle callbacks using functional setState.
  // No dependencies needed — prev => !prev is always current.
  const toggleCover = useCallback(() => setShowCover((prev) => !prev), [])
  const toggleVisualizerEnabled = useCallback(() => setEnableVisualizer((prev) => !prev), [])
  const toggleAutoMode = useCallback(() => setAutoMode((prev) => !prev), [])
  const openPresetManagerPage = useCallback(() => navigate('/visualizer-presets'), [navigate])

  const title = currentFile?.title || currentFile?.fileName || 'Unknown Title'
  const artist = currentFile?.artist || 'Unknown Artist'
  const songStats = [
    {
      label: 'Horas',
      value: formatListeningHours(currentFile?.active_listening_seconds)
    },
    {
      label: 'Cortas',
      value: currentFile?.short_view_count || 0
    },
    {
      label: 'Largas',
      value: currentFile?.long_view_count || 0
    },
    {
      label: 'Repeticiones',
      value: currentFile?.consecutive_repeat_count || 0
    },
    {
      label: 'Skips',
      value: currentFile?.skip_count || 0
    }
  ]

  // [P12] Memoized background style objects — avoids creating new objects per render
  // when currentCover hasn't changed.
  const coverBackgroundStyle = useMemo(
    () => (currentCover ? { backgroundImage: `url(${currentCover})` } : undefined),
    [currentCover]
  )

  const visiblePresetQueue = useMemo(
    () => (Array.isArray(presetControls.allPresets) ? presetControls.allPresets : []),
    [presetControls.allPresets]
  )

  const activePresetListLabel = presetControls.activePresetList?.name || 'Presets aleatorios'

  useEffect(() => {
    if (!presetPreviewListRef.current || visiblePresetQueue.length === 0) {
      return
    }

    const currentIndex =
      Number.isInteger(presetControls.currentPresetIndex) && presetControls.currentPresetIndex >= 0
        ? presetControls.currentPresetIndex
        : 0

    presetPreviewListRef.current.scrollToItem(currentIndex, 'smart')
  }, [presetControls.currentPresetIndex, visiblePresetQueue.length])

  return (
    <div
      className={`Music ${!enableVisualizer ? 'no-visualizer' : ''}`}
      onClick={handleBackgroundClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cover como fondo cuando está oculto */}
      {!showCover && currentCover && (
        <div className="cover-as-background" style={coverBackgroundStyle} />
      )}

      {/* Cover borroso como fondo cuando está activo y el visualizador está apagado */}
      {showCover && currentCover && !enableVisualizer && (
        <div className="blurred-cover-background" style={coverBackgroundStyle} />
      )}

      {/* Fondo Visualizador */}
      {enableVisualizer && audioEl && (
        <div className="visualizer-background">
          <Render audioElement={audioEl} presetName={presetControls.currentPresetName} />
        </div>
      )}

      {/* Contenido Principal */}
      <div className="Player-main">
        {visiblePresetQueue.length > 0 && (
          <aside className="preset-preview-panel" aria-label="Presets cargados">
            <div className="preset-preview-panel__header">
              <div className="preset-preview-panel__heading">
                <span>Presets cargados</span>
                <strong>{activePresetListLabel}</strong>
              </div>
              <strong>{visiblePresetQueue.length}</strong>
            </div>

            <div className="preset-preview-panel__list">
              <FixedSizeList
                ref={presetPreviewListRef}
                height={Math.min(visiblePresetQueue.length * PRESET_PREVIEW_ROW_HEIGHT, 360)}
                itemCount={visiblePresetQueue.length}
                itemSize={PRESET_PREVIEW_ROW_HEIGHT}
                width="100%"
              >
                {({ index, style }) => {
                  const presetName = visiblePresetQueue[index]
                  const isCurrent = index === presetControls.currentPresetIndex

                  return (
                    <div
                      style={style}
                      className={`preset-preview-item ${isCurrent ? 'is-current' : ''}`}
                    >
                      <span className="preset-preview-item__index">
                        {isCurrent ? 'Now' : index + 1}
                      </span>
                      <span className="preset-preview-item__name">{presetName}</span>
                    </div>
                  )
                }}
              </FixedSizeList>
            </div>
          </aside>
        )}

        {showCover && (
          <div className="cover-wrapper">
            <div className="cover-container">
              {currentCover ? (
                <img src={currentCover} alt="Cover" className="album-cover" />
              ) : (
                <div className="no-cover">No Cover</div>
              )}
            </div>
            <div className="track-info-overlay">
              <h1 className="title">{title}</h1>
              <h2 className="artist">{artist}</h2>
              <div className="stats">
                <div className="song-stat-grid">
                  {songStats.map((stat) => (
                    <span className="song-stat-pill" key={stat.label}>
                      <strong>{stat.value}</strong>
                      <small>{stat.label}</small>
                    </span>
                  ))}
                </div>
                <button
                  className={`like-btn ${likeState.currentLike ? 'liked' : ''}`}
                  onClick={handleLikeClick}
                  disabled={!currentFile}
                >
                  {likeState.currentLike ? <LuHeart fill="currentColor" /> : <LuHeartOff />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles Flotantes */}
      <div className={`Player ${showControls ? 'visible' : ''}`}>
        <div className="view-switcher">
          <button className={`switcher-btn ${showCover ? 'active' : ''}`} onClick={toggleCover}>
            <LuImage /> {showCover ? 'Ocultar Cover' : 'Mostrar Cover'}
          </button>

          <button
            className={`switcher-btn ${enableVisualizer ? 'active' : ''}`}
            onClick={toggleVisualizerEnabled}
          >
            <LuActivity /> {enableVisualizer ? 'Desactivar Visualizador' : 'Activar Visualizador'}
          </button>

          <button className={`switcher-btn ${autoMode ? 'active' : ''}`} onClick={toggleAutoMode}>
            {autoMode ? <LuPlay /> : <LuSettings />}
            {autoMode ? 'Modo Auto' : 'Modo Manual'}
          </button>

          <button className="switcher-btn" onClick={openPresetManagerPage}>
            <LuLayoutGrid />
            Admin Presets
          </button>
        </div>

        {/* RenderControls visible en Modo Manual y si el visualizador está activo */}
        {!autoMode && enableVisualizer && (
          <div className="render-controls-wrapper">
            <RenderControls
              currentPresetName={presetControls.currentPresetName}
              currentPresetIndex={presetControls.currentPresetIndex}
              allPresets={presetControls.allPresets}
              isPresetPaused={presetControls.isPresetPaused}
              onNext={presetControls.nextPreset}
              onPrev={presetControls.prevPreset}
              onTogglePause={presetControls.togglePresetPause}
              onSelectPreset={presetControls.setPresetIndex}
            />
          </div>
        )}
      </div>
    </div>
  )
}
export default Music
