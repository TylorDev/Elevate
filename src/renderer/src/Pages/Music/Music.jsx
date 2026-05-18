import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { FixedSizeList } from 'react-window'
import './Music.scss'

import Render from '../../components/Render/Render'
import { OverflowMenu } from '../../components/OverflowMenu/OverflowMenu'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { useNavigate } from 'react-router-dom'
import {
  useVisualizerCatalog,
  useVisualizerFavoriteActions,
  useVisualizerPlayback,
  useVisualizerSources
} from '../../components/Render/useVisualizerPresets'
import {
  LuActivity,
  LuHeart,
  LuHeartOff,
  LuImage,
  LuLayoutGrid,
  LuList,
  LuPause,
  LuPlay,
  LuSave,
  LuSkipBack,
  LuSkipForward
} from 'react-icons/lu'

const PRESET_PREVIEW_ROW_HEIGHT = 48

const STATIC_CONTEXT_MENU_OPTIONS = [
  { id: 'toggle-cover', label: 'Toggle Cover', icon: <LuImage /> },
  { id: 'toggle-visualizer', label: 'Toggle Visualizer', icon: <LuActivity /> },
  { id: 'previous-preset', label: 'Previous Preset', icon: <LuSkipBack /> },
  { id: 'next-preset', label: 'Next Preset', icon: <LuSkipForward /> },
  { id: 'save-preset', label: 'Save Preset', icon: <LuSave /> },
  { id: 'go-to-admin-presets', label: 'Go to Admin Presets', icon: <LuLayoutGrid /> },
  { id: 'toggle-preset-list', label: 'Toggle Preset List', icon: <LuList /> }
]

function formatListeningHours(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0)
  const hours = totalSeconds / 3600

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }

  return `${Math.round(totalSeconds / 60)} min`
}

function PresetPreviewRow({ data, index, style }) {
  const presetName = data.presets[index]
  const isCurrent = index === data.currentPresetIndex

  return (
    <div style={style} className={`preset-preview-item ${isCurrent ? 'is-current' : ''}`}>
      <span className="preset-preview-item__index">{isCurrent ? 'Now' : index + 1}</span>
      <span className="preset-preview-item__name">{presetName}</span>
    </div>
  )
}

function Music() {
  const navigate = useNavigate()
  const { mediaRef, currentFile, togglePlayPause, queueState } = useSuper()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const [audioEl, setAudioEl] = useState(null)

  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [showPresetList, setShowPresetList] = useState(false)
  const menuRef = useRef(null)
  const presetPreviewListRef = useRef(null)

  const {
    currentPresetIndex,
    currentPresetName: rawCurrentPresetName,
    isPresetPaused,
    allPresets,
    togglePresetPause,
    prevPreset,
    nextPreset
  } = useVisualizerPlayback()
  const { activePresetList } = useVisualizerSources()
  const { isFavorite } = useVisualizerCatalog()
  const { toggleFavorite } = useVisualizerFavoriteActions()

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
  const togglePresetList = useCallback(() => setShowPresetList((prev) => !prev), [])
  const openPresetManagerPage = useCallback(() => navigate('/visualizer-presets'), [navigate])
  const currentPresetName = rawCurrentPresetName || ''
  const isCurrentPresetFavorite = currentPresetName
    ? isFavorite?.(currentPresetName) === true
    : false
  const dynamicContextMenuOptions = useMemo(
    () => [
      {
        id: 'pause-loop',
        label: 'Pause Loop',
        icon: isPresetPaused ? <LuPlay /> : <LuPause />
      },
      {
        id: 'like-preset',
        label: 'Like Preset',
        icon: isCurrentPresetFavorite ? <LuHeart /> : <LuHeartOff />
      }
    ],
    [isCurrentPresetFavorite, isPresetPaused]
  )
  const contextMenuOptions = useMemo(
    () => [
      STATIC_CONTEXT_MENU_OPTIONS[0],
      STATIC_CONTEXT_MENU_OPTIONS[1],
      dynamicContextMenuOptions[0],
      STATIC_CONTEXT_MENU_OPTIONS[2],
      STATIC_CONTEXT_MENU_OPTIONS[3],
      dynamicContextMenuOptions[1],
      STATIC_CONTEXT_MENU_OPTIONS[4],
      STATIC_CONTEXT_MENU_OPTIONS[5],
      STATIC_CONTEXT_MENU_OPTIONS[6]
    ],
    [dynamicContextMenuOptions]
  )

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
        case 'pause-loop':
          togglePresetPause()
          break
        case 'previous-preset':
          prevPreset()
          break
        case 'next-preset':
          nextPreset()
          break
        case 'like-preset':
          if (currentPresetName) {
            toggleFavorite(currentPresetName)
          }
          break
        case 'save-preset':
          // Placeholder action until preset saving is implemented.
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
      currentPresetName,
      nextPreset,
      openPresetManagerPage,
      prevPreset,
      toggleFavorite,
      toggleCover,
      togglePresetPause,
      togglePresetList,
      toggleVisualizerEnabled
    ]
  )

  const title = currentFile?.title || currentFile?.fileName || 'Unknown Title'
  const artist = currentFile?.artist || 'Unknown Artist'
  const songStats = useMemo(
    () => [
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
    ],
    [currentFile]
  )

  const coverBackgroundStyle = useMemo(
    () => (currentCover ? { backgroundImage: `url(${currentCover})` } : undefined),
    [currentCover]
  )

  const visiblePresetQueue = useMemo(() => (Array.isArray(allPresets) ? allPresets : []), [allPresets])

  const activePresetListLabel = activePresetList?.name || 'Presets aleatorios'
  const presetPreviewListData = useMemo(
    () => ({
      presets: visiblePresetQueue,
      currentPresetIndex
    }),
    [currentPresetIndex, visiblePresetQueue]
  )

  useEffect(() => {
    if (!showPresetList || !presetPreviewListRef.current || visiblePresetQueue.length === 0) {
      return
    }

    const currentIndex =
      Number.isInteger(currentPresetIndex) && currentPresetIndex >= 0
        ? currentPresetIndex
        : 0

    presetPreviewListRef.current.scrollToItem(currentIndex, 'smart')
  }, [currentPresetIndex, showPresetList, visiblePresetQueue.length])

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
          <Render audioElement={audioEl} presetName={currentPresetName} />
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
                itemData={presetPreviewListData}
                width="100%"
              >
                {PresetPreviewRow}
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

      {enableVisualizer && currentPresetName && (
        <div className="current-preset-name" title={currentPresetName}>
          {currentPresetName}
        </div>
      )}

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
