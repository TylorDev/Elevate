import { lazy, Suspense, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { toast } from 'react-toastify'
import './Music.scss'

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
import { usePlayback } from '../../Contexts/PlaybackContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useBackground } from '../../Contexts/BackgroundContext'
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

const RIGHT_CLICK_HINT_WIDTH = 108
const RIGHT_CLICK_HINT_HEIGHT = 34
const RIGHT_CLICK_HINT_OFFSET_X = 18
const RIGHT_CLICK_HINT_OFFSET_Y = 18
const RIGHT_CLICK_HINT_STORAGE_KEY = 'music.rightClickHintDismissed'
const Render = lazy(() => import('../../components/Render/Render'))

const STATIC_CONTEXT_MENU_OPTIONS = [
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
  const { rightClickHintDisabled } = useSuper()
  const { currentFile } = useQueue()
  const { mediaElement, togglePlayPause } = usePlayback()
  const { currentCover } = usePlaylists()
  const { backgroundImageUrl } = useBackground()
  const activeCover = currentCover || backgroundImageUrl
  const [audioEl, setAudioEl] = useState(null)

  const [showCover, setShowCover] = useState(true)
  const [enableVisualizer, setEnableVisualizer] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(true)
  const [pendingSaveListIds, setPendingSaveListIds] = useState([])
  const [rightClickHint, setRightClickHint] = useState({
    isVisible: false,
    x: RIGHT_CLICK_HINT_OFFSET_X,
    y: RIGHT_CLICK_HINT_OFFSET_Y
  })
  const [isRightClickHintDismissed, setIsRightClickHintDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(RIGHT_CLICK_HINT_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const musicRef = useRef(null)
  const menuRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const savePresetInitialIdsRef = useRef([])
  const savePresetWasPausedRef = useRef(true)
  const wasVisualizerEnabledRef = useRef(enableVisualizer)
  const shuffleManuallyDisabledRef = useRef(false)

  const {
    currentPresetName: rawCurrentPresetName,
    isPresetPaused,
    isPresetCycleActive,
    isShuffled,
    setVisualizerCyclingVisibility,
    setShuffleEnabled,
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
    effectivePresetSource,
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
    if (mediaElement) {
      setAudioEl(mediaElement)
    }
  }, [mediaElement])

  useEffect(() => {
    setVisualizerCyclingVisibility(enableVisualizer)

    return () => {
      setVisualizerCyclingVisibility(false)
    }
  }, [enableVisualizer, setVisualizerCyclingVisibility])

  useEffect(() => {
    const wasVisualizerEnabled = wasVisualizerEnabledRef.current
    wasVisualizerEnabledRef.current = enableVisualizer

    if (!enableVisualizer || wasVisualizerEnabled) {
      return
    }

    if (effectivePresetSource?.mode === 'favorites' || shuffleManuallyDisabledRef.current) {
      return
    }

    if (!isShuffled) {
      setShuffleEnabled(true)
    }
  }, [effectivePresetSource?.mode, enableVisualizer, isShuffled, setShuffleEnabled])

  useEffect(() => {
    if (!rightClickHintDisabled) {
      return
    }

    setRightClickHint((currentState) =>
      currentState.isVisible ? { ...currentState, isVisible: false } : currentState
    )
  }, [rightClickHintDisabled])

  const handleBackgroundClick = useCallback(
    (event) => {
      if (event.target instanceof window.Element && event.target.closest('button')) {
        return
      }

      togglePlayPause()
    },
    [togglePlayPause]
  )

  const toggleCover = useCallback(() => {
    setShowCover((previousValue) => {
      const nextShowCover = !previousValue

      setEnableVisualizer((previousVisualizerValue) =>
        !nextShowCover && !previousVisualizerValue ? true : previousVisualizerValue
      )

      return nextShowCover
    })
  }, [])

  const toggleVisualizerEnabled = useCallback(() => {
    setEnableVisualizer((previousValue) => {
      const nextEnableVisualizer = !previousValue

      setShowCover((previousCoverValue) =>
        !nextEnableVisualizer && !previousCoverValue ? true : previousCoverValue
      )

      return nextEnableVisualizer
    })
  }, [])

  const handleShuffleToggle = useCallback(() => {
    shuffleManuallyDisabledRef.current = isShuffled
    toggleShuffle()
  }, [isShuffled, toggleShuffle])

  const handleOpenSongHistory = useCallback(
    (event) => {
      event.stopPropagation()

      if (!currentFile?.filePath) {
        return
      }

      navigate(`/history/song/${encodeURIComponent(currentFile.filePath)}`)
    },
    [currentFile?.filePath, navigate]
  )
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
    setRightClickHint((currentState) =>
      currentState.isVisible ? { ...currentState, isVisible: false } : currentState
    )

    if (rightClickHintDisabled) {
      menuRef.current?.open(event)
      return
    }

    setIsRightClickHintDismissed(true)

    try {
      window.sessionStorage.setItem(RIGHT_CLICK_HINT_STORAGE_KEY, 'true')
    } catch {
      // Ignore session storage issues; the in-memory dismissed state still prevents re-showing.
    }

    menuRef.current?.open(event)
  }, [rightClickHintDisabled])

  const hideRightClickHint = useCallback(() => {
    setRightClickHint((currentState) =>
      currentState.isVisible ? { ...currentState, isVisible: false } : currentState
    )
  }, [])

  const updateRightClickHint = useCallback(
    (event) => {
      if (rightClickHintDisabled) {
        hideRightClickHint()
        return
      }

      if (isRightClickHintDismissed) {
        hideRightClickHint()
        return
      }

      const musicElement = musicRef.current
      const eventTarget = event.target

      if (!musicElement || !(eventTarget instanceof window.Element)) {
        hideRightClickHint()
        return
      }

      if (
        eventTarget.closest(
          'button, .cover-wrapper, .visualizer-controls-panel, .current-preset-name, .preset-nav-controls'
        )
      ) {
        hideRightClickHint()
        return
      }

      const isBackgroundVisible =
        enableVisualizer || !showCover || (showCover && activeCover && !enableVisualizer)

      if (!isBackgroundVisible) {
        hideRightClickHint()
        return
      }

      const rect = musicElement.getBoundingClientRect()
      const nextX = Math.min(
        Math.max(event.clientX - rect.left + RIGHT_CLICK_HINT_OFFSET_X, 12),
        rect.width - RIGHT_CLICK_HINT_WIDTH - 12
      )
      const nextY = Math.min(
        Math.max(event.clientY - rect.top + RIGHT_CLICK_HINT_OFFSET_Y, 12),
        rect.height - RIGHT_CLICK_HINT_HEIGHT - 12
      )

      setRightClickHint({
        isVisible: true,
        x: nextX,
        y: nextY
      })
    },
    [
      activeCover,
      enableVisualizer,
      hideRightClickHint,
      isRightClickHintDismissed,
      rightClickHintDisabled,
      showCover
    ]
  )

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
      setShuffleEnabled(true)

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
    [setPresetSource, setShuffleEnabled]
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
        toast.error('Could not remove the preset from the current list')
      }
    },
    [canRemoveCurrentPresetFromList, currentPresetName, effectivePresetList, togglePresetInList]
  )

  const contextMenuOptions = useMemo(
    () => [
      {
        id: 'toggle-cover',
        label: 'Toggle Cover',
        icon: <LuImage />,
        checked: showCover
      },
      {
        id: 'toggle-visualizer',
        label: 'Toggle Visualizer',
        icon: <LuActivity />,
        checked: enableVisualizer
      },
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
      STATIC_CONTEXT_MENU_OPTIONS[0]
    ],
    [
      enableVisualizer,
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
      presetSource.mode,
      showCover
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

  const coverBackgroundStyle = useMemo(
    () => (activeCover ? { backgroundImage: `url(${activeCover})` } : undefined),
    [activeCover]
  )

  return (
    <div
      ref={musicRef}
      className={`Music ${!enableVisualizer ? 'no-visualizer' : ''}`}
      onClick={handleBackgroundClick}
      onContextMenu={handleContextMenu}
      onMouseLeave={hideRightClickHint}
      onMouseMove={updateRightClickHint}
    >
      {!showCover && activeCover && (
        <div className="cover-as-background" style={coverBackgroundStyle} />
      )}

      {showCover && activeCover && !enableVisualizer && (
        <div className="blurred-cover-background" style={coverBackgroundStyle} />
      )}

      {enableVisualizer && audioEl && (
        <div className="visualizer-background">
          <Suspense fallback={null}>
            <Render
              audioElement={audioEl}
              canvasRefExternal={visualizerCanvasRef}
              presetName={currentPresetName}
            />
          </Suspense>
        </div>
      )}

      {rightClickHint.isVisible ? (
        <div
          className="music-right-click-hint"
          style={{
            left: `${rightClickHint.x}px`,
            top: `${rightClickHint.y}px`
          }}
        >
          Right Click
        </div>
      ) : null}

      <div className="Player-main">
        {showCover && (
          <button
            className={`cover-wrapper ${currentFile?.filePath ? 'is-clickable' : ''}`}
            onClick={handleOpenSongHistory}
            type="button"
            disabled={!currentFile?.filePath}
            aria-label={currentFile?.filePath ? 'Open song history' : undefined}
            title={currentFile?.filePath ? 'Open song history' : undefined}
          >
            <div className="cover-container">
              {activeCover ? (
                <img src={activeCover} alt="Cover" className="album-cover" />
              ) : (
                <div className="no-cover">No Cover</div>
              )}
            </div>
          </button>
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
              onClick={handleShuffleToggle}
              type="button"
            >
              <LuShuffle />
            </button>

            <button
              className={`visualizer-control-btn ${isPresetPaused ? 'is-active' : ''}`}
              onClick={togglePresetPause}
              title={
                isPresetPaused
                  ? 'Resume preset cycling'
                  : isPresetCycleActive
                    ? 'Pause preset cycling'
                    : 'Preset cycling will resume when the visualizer is visible'
              }
              type="button"
            >
              {isPresetPaused ? <LuPlay /> : <LuPause />}
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
                  title={`Remove from ${effectivePresetList?.name || 'the current list'}`}
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
