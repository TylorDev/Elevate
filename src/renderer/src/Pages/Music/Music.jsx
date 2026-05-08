import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import './Music.scss'

import Render from '../../components/Render/Render'
import RenderControls from '../../components/Render/RenderControls'
import { useVisualizerPresets } from '../../components/Render/useVisualizerPresets'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { LuHeart, LuHeartOff, LuImage, LuActivity, LuSettings, LuPlay } from 'react-icons/lu'

function Music() {
  const { mediaRef, currentFile } = useSuper()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const [audioEl, setAudioEl] = useState(null)
  
  // Toggles de la UI
  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [autoMode, setAutoMode] = useState(true)

  const [showControls, setShowControls] = useState(false)
  const idleTimer = useRef(null)

  const presetControls = useVisualizerPresets()

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
  const handleLikeClick = useCallback((event) => {
    event.stopPropagation()
    if (currentFile) {
      toggleLike(currentFile)
    }
  }, [currentFile, toggleLike])

  // [P11] Stable toggle callbacks using functional setState.
  // No dependencies needed — prev => !prev is always current.
  const toggleCover = useCallback(() => setShowCover(prev => !prev), [])
  const toggleVisualizerEnabled = useCallback(() => setEnableVisualizer(prev => !prev), [])
  const toggleAutoMode = useCallback(() => setAutoMode(prev => !prev), [])

  const title = currentFile?.title || currentFile?.fileName || 'Unknown Title'
  const artist = currentFile?.artist || 'Unknown Artist'
  const views = currentFile?.play_count || 0

  // [P12] Memoized background style objects — avoids creating new objects per render
  // when currentCover hasn't changed.
  const coverBackgroundStyle = useMemo(
    () => currentCover ? { backgroundImage: `url(${currentCover})` } : undefined,
    [currentCover]
  )

  return (
    <div className={`Music ${!enableVisualizer ? 'no-visualizer' : ''}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      
      {/* Cover como fondo cuando está oculto */}
      {!showCover && currentCover && (
        <div 
          className="cover-as-background" 
          style={coverBackgroundStyle}
        />
      )}

      {/* Cover borroso como fondo cuando está activo y el visualizador está apagado */}
      {showCover && currentCover && !enableVisualizer && (
        <div 
          className="blurred-cover-background" 
          style={coverBackgroundStyle}
        />
      )}

      {/* Fondo Visualizador */}
      {enableVisualizer && audioEl && (
        <div className="visualizer-background">
          <Render 
            audioElement={audioEl} 
            presetName={presetControls.currentPresetName} 
          />
        </div>
      )}

      {/* Contenido Principal */}
      <div className="Player-main">
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
                <span className="views">{views} reprod.</span>
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
          <button 
            className={`switcher-btn ${showCover ? 'active' : ''}`}
            onClick={toggleCover}
          >
            <LuImage /> {showCover ? 'Ocultar Cover' : 'Mostrar Cover'}
          </button>
          
          <button 
            className={`switcher-btn ${enableVisualizer ? 'active' : ''}`}
            onClick={toggleVisualizerEnabled}
          >
            <LuActivity /> {enableVisualizer ? 'Desactivar Visualizador' : 'Activar Visualizador'}
          </button>

          <button 
            className={`switcher-btn ${autoMode ? 'active' : ''}`}
            onClick={toggleAutoMode}
          >
            {autoMode ? <LuPlay /> : <LuSettings />} 
            {autoMode ? 'Modo Auto' : 'Modo Manual'}
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
