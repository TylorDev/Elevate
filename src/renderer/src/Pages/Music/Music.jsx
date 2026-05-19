import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { toast } from 'react-toastify'
import './Music.scss'

import Render from '../../components/Render/Render'
import { OverflowMenu } from '../../components/OverflowMenu/OverflowMenu'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'
import { useNavigate } from 'react-router-dom'
import {
  useVisualizerCatalog,
  useVisualizerFavoriteActions,
  useVisualizerListActions,
  useVisualizerPlayback,
  useVisualizerSettingsActions,
  useVisualizerSources
} from '../../components/Render/useVisualizerPresets'
import {
  LuActivity,
  LuCamera,
  LuEye,
  LuEyeOff,
  LuHeart,
  LuHeartOff,
  LuImage,
  LuLayoutGrid,
  LuList,
  LuListMusic,
  LuPause,
  LuPlay,
  LuSave,
  LuShuffle,
  LuSkipBack,
  LuSkipForward,
  LuTrash2
} from 'react-icons/lu'

const STATIC_CONTEXT_MENU_OPTIONS = [
  { id: 'toggle-cover', label: 'Toggle Cover', icon: <LuImage /> },
  { id: 'toggle-visualizer', label: 'Toggle Visualizer', icon: <LuActivity /> },
  { id: 'go-to-admin-presets', label: 'Go to Admin Presets', icon: <LuLayoutGrid /> }
]

const CYCLE_DURATION_OPTIONS = [
  { label: '10 sec', value: '10000' },
  { label: '15 sec', value: '15000' },
  { label: '30 sec', value: '30000' }
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
  const { mediaRef, currentFile, togglePlayPause } = useSuper()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()
  const [audioEl, setAudioEl] = useState(null)

  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const [pendingSaveListIds, setPendingSaveListIds] = useState([])
  const menuRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const savePresetInitialIdsRef = useRef([])
  const savePresetWasPausedRef = useRef(true)

  const {
    currentPresetName: rawCurrentPresetName,
    isPresetPaused,
    isShuffled,
    togglePresetPause,
    toggleShuffle,
    prevPreset,
    nextPreset,
    setPresetPaused
  } = useVisualizerPlayback()
  const {
    activePresetList,
    cycleDurationMs,
    effectivePresetList,
    presetLists,
    presetSource,
    sourceAssociations
  } = useVisualizerSources()
  const { isFavorite } = useVisualizerCatalog()
  const { toggleFavorite } = useVisualizerFavoriteActions()
  const { createPresetList, togglePresetInList } = useVisualizerListActions()
  const { setCycleDurationMs, setPresetCover, setPresetSource } = useVisualizerSettingsActions()
  const [captureState, setCaptureState] = useState('idle')
  const [newPresetListName, setNewPresetListName] = useState('')
  const currentPresetName = rawCurrentPresetName || ''

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
  const openPresetManagerPage = useCallback(() => navigate('/visualizer-presets'), [navigate])
  const canCapturePresetFrame = Boolean(
    enableVisualizer && currentPresetName && visualizerCanvasRef.current
  )
  const isCurrentPresetFavorite = currentPresetName
    ? isFavorite?.(currentPresetName) === true
    : false
  const canRemoveCurrentPresetFromList = Boolean(
    currentPresetName &&
    effectivePresetList?.id &&
    effectivePresetList.presetNames.includes(currentPresetName)
  )
  const selectedCycleDurationLabel =
    CYCLE_DURATION_OPTIONS.find((option) => option.value === String(cycleDurationMs))?.label ||
    '10 sec'

  const orderedLoadLists = useMemo(() => {
    const associatedListIds = new Set(Object.values(sourceAssociations || {}).filter(Boolean))
    const currentAssociatedListId = activePresetList?.id || ''

    return [...presetLists].sort((firstList, secondList) => {
      const getRank = (list) => {
        if (list.id === currentAssociatedListId) {
          return 0
        }

        if (associatedListIds.has(list.id)) {
          return 1
        }

        return 2
      }

      const rankDifference = getRank(firstList) - getRank(secondList)
      if (rankDifference !== 0) {
        return rankDifference
      }

      return firstList.name.localeCompare(secondList.name)
    })
  }, [activePresetList?.id, presetLists, sourceAssociations])

  const handleContextMenu = useCallback((event) => {
    menuRef.current?.open(event)
  }, [])

  const handleCapturePresetFrame = useCallback(() => {
    const sourceCanvas = visualizerCanvasRef.current

    if (!enableVisualizer || !currentPresetName || !sourceCanvas) {
      return
    }

    try {
      const thumbnailCanvas = document.createElement('canvas')
      thumbnailCanvas.width = 128
      thumbnailCanvas.height = 128

      const context = thumbnailCanvas.getContext('2d', { alpha: true })
      if (!context) {
        setCaptureState('error')
        return
      }

      context.drawImage(sourceCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)
      const coverData = thumbnailCanvas.toDataURL('image/png')
      setPresetCover(currentPresetName, coverData)
      setCaptureState('saved')
      window.setTimeout(() => setCaptureState('idle'), 1800)
    } catch (error) {
      console.error('Failed to capture preset frame:', error)
      setCaptureState('error')
      window.setTimeout(() => setCaptureState('idle'), 1800)
    }
  }, [currentPresetName, enableVisualizer, setPresetCover])

  const handleOpenSavePreset = useCallback(() => {
    if (!currentPresetName) {
      return
    }

    const initiallySelectedListIds = presetLists
      .filter((list) => list.presetNames.includes(currentPresetName))
      .map((list) => list.id)

    savePresetInitialIdsRef.current = initiallySelectedListIds
    savePresetWasPausedRef.current = isPresetPaused
    setPendingSaveListIds(initiallySelectedListIds)
    setNewPresetListName('')

    if (!isPresetPaused) {
      setPresetPaused(true)
    }
  }, [currentPresetName, isPresetPaused, presetLists, setPresetPaused])

  const handleToggleSavePresetList = useCallback((listId) => {
    setPendingSaveListIds((currentListIds) =>
      currentListIds.includes(listId)
        ? currentListIds.filter((currentListId) => currentListId !== listId)
        : [...currentListIds, listId]
    )
  }, [])

  const handleCloseSavePreset = useCallback(async () => {
    if (!currentPresetName) {
      setPresetPaused(savePresetWasPausedRef.current)
      return
    }

    const initialSelectedIds = new Set(savePresetInitialIdsRef.current)
    const finalSelectedIds = new Set(pendingSaveListIds)
    const changedListIds = presetLists
      .filter((list) => initialSelectedIds.has(list.id) !== finalSelectedIds.has(list.id))
      .map((list) => list.id)

    for (const listId of changedListIds) {
      await togglePresetInList(listId, currentPresetName)
    }

    if (changedListIds.length > 0) {
      toast.success(
        `Preset guardado en ${changedListIds.length} ${changedListIds.length === 1 ? 'lista' : 'listas'}`
      )
    }

    setPresetPaused(savePresetWasPausedRef.current)
  }, [currentPresetName, pendingSaveListIds, presetLists, setPresetPaused, togglePresetInList])

  const handleLoadPresetList = useCallback(
    (sourceId) => {
      if (sourceId === '__favorites__') {
        void setPresetSource({
          mode: 'favorites',
          listId: null
        })
        return
      }

      if (sourceId === '__all__') {
        void setPresetSource({
          mode: 'all',
          listId: null
        })
        return
      }

      void setPresetSource({
        mode: 'list',
        listId: sourceId
      })
    },
    [setPresetSource]
  )

  const handleCreatePresetList = useCallback(async () => {
    const trimmedName = newPresetListName.trim()

    if (!trimmedName) {
      return
    }

    const createdList = await createPresetList(trimmedName)

    if (!createdList?.id) {
      toast.error('No se pudo crear la preset list')
      return
    }

    setPendingSaveListIds((currentListIds) =>
      currentListIds.includes(createdList.id) ? currentListIds : [...currentListIds, createdList.id]
    )
    setNewPresetListName('')
  }, [createPresetList, newPresetListName])

  const handlePresetFavoriteClick = useCallback(
    (event) => {
      event.stopPropagation()
      if (currentPresetName) {
        toggleFavorite(currentPresetName)
      }
    },
    [currentPresetName, toggleFavorite]
  )

  const handleRemovePresetFromCurrentList = useCallback(
    async (event) => {
      event.stopPropagation()

      if (!canRemoveCurrentPresetFromList || !effectivePresetList?.id || !currentPresetName) {
        return
      }

      try {
        await togglePresetInList(effectivePresetList.id, currentPresetName)
        toast.success(`Preset eliminado de ${effectivePresetList.name}`)
      } catch (error) {
        console.error('Failed to remove preset from current list:', error)
        toast.error('No se pudo eliminar el preset de la lista actual')
      }
    },
    [canRemoveCurrentPresetFromList, currentPresetName, effectivePresetList, togglePresetInList]
  )

  const contextMenuOptions = useMemo(
    () => [
      STATIC_CONTEXT_MENU_OPTIONS[0],
      STATIC_CONTEXT_MENU_OPTIONS[1],
      {
        id: 'save-preset',
        label: 'Save Preset',
        icon: <LuSave />,
        type: 'multi-select',
        disabled: !currentPresetName,
        items: [
          {
            id: '__new_list__',
            type: 'input',
            placeholder: 'Nueva preset list',
            value: newPresetListName,
            onValueChange: setNewPresetListName,
            onSubmit: () => {
              void handleCreatePresetList()
            },
            onEscape: () => setNewPresetListName('')
          },
          ...presetLists.map((list) => ({
            id: list.id,
            label: list.name,
            checked: pendingSaveListIds.includes(list.id)
          }))
        ],
        onOpen: handleOpenSavePreset,
        onClose: () => {
          void handleCloseSavePreset()
        },
        onItemToggle: handleToggleSavePresetList
      },
      {
        id: 'load-list',
        label: 'Load List',
        icon: <LuList />,
        type: 'single-select',
        items: [
          {
            id: '__favorites__',
            label: 'Favourite Presets',
            icon: <LuHeart />,
            checked: presetSource.mode === 'favorites'
          },
          {
            id: '__all__',
            label: 'All Presets',
            icon: <LuListMusic />,
            checked: presetSource.mode === 'all'
          },
          ...orderedLoadLists.map((list) => ({
            id: list.id,
            label: list.name,
            icon: <LuList />,
            checked: presetSource.mode === 'list' && presetSource.listId === list.id
          }))
        ],
        onItemSelect: handleLoadPresetList
      },
      STATIC_CONTEXT_MENU_OPTIONS[2]
    ],
    [
      currentPresetName,
      handleCloseSavePreset,
      handleCreatePresetList,
      handleLoadPresetList,
      handleOpenSavePreset,
      handleToggleSavePresetList,
      newPresetListName,
      orderedLoadLists,
      pendingSaveListIds,
      presetLists,
      presetSource.listId,
      presetSource.mode
    ]
  )

  const handleMenuSelect = useCallback(
    (optionId) => {
      switch (optionId) {
        case 'toggle-cover':
          toggleCover()
          break
        case 'toggle-visualizer':
          toggleVisualizerEnabled()
          break
        case 'go-to-admin-presets':
          openPresetManagerPage()
          break
        default:
          break
      }
    },
    [openPresetManagerPage, toggleCover, toggleVisualizerEnabled]
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
          <Render
            audioElement={audioEl}
            canvasRefExternal={visualizerCanvasRef}
            presetName={currentPresetName}
          />
        </div>
      )}

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

      {enableVisualizer && (
        <button
          className="controls-visibility-btn"
          onClick={() => setControlsHidden((previousValue) => !previousValue)}
          type="button"
        >
          {controlsHidden ? <LuEye /> : <LuEyeOff />}
        </button>
      )}

      {enableVisualizer && !controlsHidden && (
        <>
          <div className="visualizer-controls-panel">
            <button
              className={`visualizer-control-btn ${isShuffled ? 'is-active' : ''}`}
              onClick={toggleShuffle}
              type="button"
            >
              <LuShuffle />
            </button>

            <button
              className={`visualizer-control-btn ${isPresetPaused ? 'is-active' : ''}`}
              onClick={togglePresetPause}
              type="button"
            >
              {isPresetPaused ? <LuPlay /> : <LuPause />}
            </button>

            <button
              className={`visualizer-control-btn ${captureState !== 'idle' ? `is-${captureState}` : ''}`.trim()}
              disabled={!canCapturePresetFrame}
              onClick={handleCapturePresetFrame}
              type="button"
            >
              <LuCamera />
              <span>
                {captureState === 'saved'
                  ? 'Frame capturado'
                  : captureState === 'error'
                    ? 'Error al capturar'
                    : 'Capturar frame'}
              </span>
            </button>

            <div className="visualizer-duration-select">
              <Select
                value={String(cycleDurationMs)}
                onValueChange={(nextValue) => {
                  void setCycleDurationMs(Number(nextValue))
                }}
              >
                <SelectTrigger className="visualizer-duration-select__trigger">
                  <SelectValue>{selectedCycleDurationLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CYCLE_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentPresetName && (
            <div className="current-preset-name" title={currentPresetName}>
              <span className="current-preset-name__text">{currentPresetName}</span>
              {canRemoveCurrentPresetFromList && (
                <button
                  className="current-preset-name__remove"
                  onClick={handleRemovePresetFromCurrentList}
                  title={`Quitar de ${effectivePresetList?.name || 'la lista actual'}`}
                  type="button"
                >
                  <LuTrash2 />
                </button>
              )}
              <button
                className={`current-preset-name__favorite ${isCurrentPresetFavorite ? 'is-active' : ''}`}
                onClick={handlePresetFavoriteClick}
                type="button"
              >
                {isCurrentPresetFavorite ? <LuHeart fill="currentColor" /> : <LuHeartOff />}
              </button>
            </div>
          )}

          <div className="preset-nav-controls">
            <button className="preset-nav-btn" onClick={prevPreset} type="button">
              <LuSkipBack />
            </button>
            <button className="preset-nav-btn" onClick={nextPreset} type="button">
              <LuSkipForward />
            </button>
          </div>
        </>
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
