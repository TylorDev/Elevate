import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { FixedSizeList } from 'react-window'
import './Music.scss'

import Render from '../../components/Render/Render'
import {
  normalizePlaybackSource,
  useVisualizerPresets
} from '../../components/Render/useVisualizerPresets'
import { OverflowMenu } from '../../components/OverflowMenu/OverflowMenu'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { useNavigate } from 'react-router-dom'
import { LuHeart, LuHeartOff } from 'react-icons/lu'

const PRESET_PREVIEW_ROW_HEIGHT = 48
const MUSIC_MENU_OPTIONS = [
  { id: 'toggle-cover', label: 'Toggle Cover' },
  { id: 'toggle-visualizer', label: 'Toggle Visualizer' },
  { id: 'toggle-mode', label: 'Toggle Mode' },
  { id: 'go-to-admin-presets', label: 'Go to Admin Presets' },
  { id: 'toggle-preset-list', label: 'Toggle Preset List' }
]

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

  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [showPresetList, setShowPresetList] = useState(false)
  const menuRef = useRef(null)
  const presetPreviewListRef = useRef(null)

  const activePlaybackSource = useMemo(
    () => normalizePlaybackSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const presetControls = useVisualizerPresets({ activePlaybackSource })

  useEffect(() => {
    const shouldBePaused = !autoMode
    if (presetControls.isPresetPaused !== shouldBePaused) {
      presetControls.togglePresetPause()
    }
  }, [autoMode, presetControls.isPresetPaused, presetControls.togglePresetPause])

  useEffect(() => {
    if (mediaRef?.current) {
      setAudioEl(mediaRef.current)
    }
  }, [mediaRef])

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

  const toggleCover = useCallback(() => setShowCover((prev) => !prev), [])
  const toggleVisualizerEnabled = useCallback(() => setEnableVisualizer((prev) => !prev), [])
  const toggleAutoMode = useCallback(() => setAutoMode((prev) => !prev), [])
  const togglePresetList = useCallback(() => setShowPresetList((prev) => !prev), [])
  const openPresetManagerPage = useCallback(() => navigate('/visualizer-presets'), [navigate])
  const contextMenuOptions = useMemo(() => MUSIC_MENU_OPTIONS, [])

  const handleContextMenu = useCallback((event) => {
    menuRef.current?.open(event)
  }, [])

  const handleMenuSelect = useCallback(
    (optionId) => {
      switch (optionId) {
        case 'toggle-cover':
          toggleCover()
          break
        case 'toggle-visualizer':
          toggleVisualizerEnabled()
          break
        case 'toggle-mode':
          toggleAutoMode()
          break
        case 'go-to-admin-presets':
          openPresetManagerPage()
          break
        case 'toggle-preset-list':
          togglePresetList()
          break
        default:
          break
      }
    },
    [
      openPresetManagerPage,
      toggleAutoMode,
      toggleCover,
      togglePresetList,
      toggleVisualizerEnabled
    ]
  )

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
    if (!showPresetList || !presetPreviewListRef.current || visiblePresetQueue.length === 0) {
      return
    }

    const currentIndex =
      Number.isInteger(presetControls.currentPresetIndex) && presetControls.currentPresetIndex >= 0
        ? presetControls.currentPresetIndex
        : 0

    presetPreviewListRef.current.scrollToItem(currentIndex, 'smart')
  }, [presetControls.currentPresetIndex, showPresetList, visiblePresetQueue.length])

  return (
    <div
      className={`Music ${!enableVisualizer ? 'no-visualizer' : ''}`}
      onClick={handleBackgroundClick}
      onContextMenu={handleContextMenu}
    >
      {!showCover && currentCover && (
        <div className="cover-as-background" style={coverBackgroundStyle} />
      )}

      {showCover && currentCover && !enableVisualizer && (
        <div className="blurred-cover-background" style={coverBackgroundStyle} />
      )}

      {enableVisualizer && audioEl && (
        <div className="visualizer-background">
          <Render audioElement={audioEl} presetName={presetControls.currentPresetName} />
        </div>
      )}

      <div className="Player-main">
        {showPresetList && visiblePresetQueue.length > 0 && (
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

      <OverflowMenu
        ref={menuRef}
        options={contextMenuOptions}
        onSelect={handleMenuSelect}
        showButton={false}
      />
    </div>
  )
}

export default Music
