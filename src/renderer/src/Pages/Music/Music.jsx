import { useEffect, useState, useRef } from 'react'
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

  // Sincronizar el autoMode con la lógica de presets
  useEffect(() => {
    // Si estamos en modo auto, isPresetPaused debe ser false.
    // Si estamos en manual, isPresetPaused debe ser true.
    if (autoMode && presetControls.isPresetPaused) {
      presetControls.togglePresetPause()
    } else if (!autoMode && !presetControls.isPresetPaused) {
      presetControls.togglePresetPause()
    }
  }, [autoMode])

  const handleMouseMove = () => {
    setShowControls(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setShowControls(false)
    }, 10000)
  }

  const handleMouseLeave = () => {
    setShowControls(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }

  useEffect(() => {
    if (mediaRef?.current && !audioEl) {
      setAudioEl(mediaRef.current)
    }
  }, [mediaRef, audioEl])

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  const handleLikeClick = (event) => {
    event.stopPropagation()
    if (currentFile) {
      toggleLike(currentFile)
    }
  }

  const title = currentFile?.title || currentFile?.fileName || 'Unknown Title'
  const artist = currentFile?.artist || 'Unknown Artist'
  const views = currentFile?.play_count || 0

  return (
    <div className={`Music ${!enableVisualizer ? 'no-visualizer' : ''}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      
      {/* Cover como fondo cuando está oculto */}
      {!showCover && currentCover && (
        <div 
          className="cover-as-background" 
          style={{ backgroundImage: `url(${currentCover})` }}
        />
      )}

      {/* Cover borroso como fondo cuando está activo y el visualizador está apagado */}
      {showCover && currentCover && !enableVisualizer && (
        <div 
          className="blurred-cover-background" 
          style={{ backgroundImage: `url(${currentCover})` }}
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
            onClick={() => setShowCover(!showCover)}
          >
            <LuImage /> {showCover ? 'Ocultar Cover' : 'Mostrar Cover'}
          </button>
          
          <button 
            className={`switcher-btn ${enableVisualizer ? 'active' : ''}`}
            onClick={() => setEnableVisualizer(!enableVisualizer)}
          >
            <LuActivity /> {enableVisualizer ? 'Desactivar Visualizador' : 'Activar Visualizador'}
          </button>

          <button 
            className={`switcher-btn ${autoMode ? 'active' : ''}`}
            onClick={() => setAutoMode(!autoMode)}
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
