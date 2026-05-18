import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import MINI from 'butterchurn-presets/lib/elevate.min.js'
import { useMini } from './MiniContext'
import { usePlaylists } from './PlaylistsContex'
import { useSuper } from './SupeContext'
import { visualizerService } from './visualizerService'
import {
  DEFAULT_CYCLE_DURATION,
  DEFAULT_SOURCE,
  buildAssociationSources,
  createPresetByNameMap,
  createStableId,
  getSourceKey,
  getSourceLabel,
  mapPresetNamesToItems,
  normalizePlaybackSource,
  normalizePresetSource,
  normalizeVisualizerState,
  shuffleArray
} from './visualizerUtils'

export {
  createPresetByNameMap,
  createStableId,
  getSourceKey,
  getSourceLabel,
  mapPresetNamesToItems,
  normalizePlaybackSource,
  normalizePresetSource
}

const PRESET_CATALOG = MINI.default || MINI
const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG)

const VisualizerStoreContext = createContext(null)
const VisualizerStoreApiContext = createContext(null)
const VisualizerCatalogContext = createContext(null)
const VisualizerSourcesContext = createContext(null)
const VisualizerSettingsActionsContext = createContext(null)
const VisualizerListActionsContext = createContext(null)
const VisualizerFavoriteActionsContext = createContext(null)
const VisualizerPlaybackContext = createContext(null)

function useRequiredContext(context, name) {
  const value = useContext(context)

  if (!value) {
    throw new Error(`${name} must be used within a VisualizerProvider`)
  }

  return value
}

function useLatestRef(value) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}

function VisualizerStoreProvider({ children }) {
  const [favorites, setFavorites] = useState([])
  const [cycleDurationMs, setCycleDurationMsState] = useState(DEFAULT_CYCLE_DURATION)
  const [presetSource, setPresetSourceState] = useState(DEFAULT_SOURCE)
  const [presetLists, setPresetLists] = useState([])
  const [sourceAssociations, setSourceAssociations] = useState({})
  const [visualizerLoaded, setVisualizerLoaded] = useState(false)

  const applyPersistedState = useCallback((rawState) => {
    const nextState = normalizeVisualizerState(rawState)

    setFavorites(nextState.favorites)
    setCycleDurationMsState(nextState.cycleDurationMs)
    setPresetSourceState(nextState.presetSource)
    setPresetLists(nextState.presetLists)
    setSourceAssociations(nextState.sourceAssociations)
  }, [])

  useEffect(() => {
    let isMounted = true

    visualizerService
      .loadVisualizerState()
      .then((response) => {
        if (!isMounted) {
          return
        }

        applyPersistedState(response.state)
        setVisualizerLoaded(true)
      })
      .catch((error) => {
        console.warn('Failed to load visualizer state from Prisma:', error)
        if (isMounted) {
          setVisualizerLoaded(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [applyPersistedState])

  const storeValue = useMemo(
    () => ({
      favorites,
      cycleDurationMs,
      presetSource,
      presetLists,
      sourceAssociations,
      visualizerLoaded
    }),
    [cycleDurationMs, favorites, presetLists, presetSource, sourceAssociations, visualizerLoaded]
  )

  const storeApi = useMemo(
    () => ({
      applyPersistedState,
      setFavorites,
      setCycleDurationMsState,
      setPresetSourceState,
      setPresetLists,
      setSourceAssociations
    }),
    [applyPersistedState]
  )

  return (
    <VisualizerStoreContext.Provider value={storeValue}>
      <VisualizerStoreApiContext.Provider value={storeApi}>
        {children}
      </VisualizerStoreApiContext.Provider>
    </VisualizerStoreContext.Provider>
  )
}

function VisualizerCatalogProvider({ children }) {
  const { favorites } = useRequiredContext(VisualizerStoreContext, 'VisualizerCatalogProvider')
  const { presetSource, selectedPresetSourceList } = useVisualizerSources()

  const favoritePresetNamesSet = useMemo(() => new Set(favorites), [favorites])

  const allPresetItems = useMemo(
    () =>
      ALL_PRESET_KEYS.map((name) => ({
        id: name,
        name,
        isFavorite: favoritePresetNamesSet.has(name)
      })),
    [favoritePresetNamesSet]
  )

  const presetByName = useMemo(() => createPresetByNameMap(allPresetItems), [allPresetItems])

  const favoritePresetItems = useMemo(
    () => allPresetItems.filter((preset) => preset.isFavorite),
    [allPresetItems]
  )

  const favoritePresetNames = useMemo(
    () => favoritePresetItems.map((preset) => preset.name),
    [favoritePresetItems]
  )

  const activePresetNames = useMemo(() => {
    if (presetSource.mode === 'favorites') {
      return favoritePresetNames.length > 0 ? favoritePresetNames : ALL_PRESET_KEYS
    }

    if (presetSource.mode === 'list') {
      const validPresetItems = mapPresetNamesToItems(
        selectedPresetSourceList?.presetNames || [],
        presetByName
      )
      return validPresetItems.length > 0
        ? validPresetItems.map((preset) => preset.name)
        : ALL_PRESET_KEYS
    }

    return ALL_PRESET_KEYS
  }, [favoritePresetNames, presetByName, presetSource.mode, selectedPresetSourceList?.presetNames])

  const activePresetItems = useMemo(
    () => mapPresetNamesToItems(activePresetNames, presetByName),
    [activePresetNames, presetByName]
  )

  const isFavorite = useCallback(
    (presetName) => favoritePresetNamesSet.has(presetName),
    [favoritePresetNamesSet]
  )

  const catalogValue = useMemo(
    () => ({
      allPresetItems,
      activePresetItems,
      activePresetNames,
      favoritePresetItems,
      favoritePresetNames,
      favoritePresetNamesSet,
      presetByName,
      isFavorite
    }),
    [
      activePresetItems,
      activePresetNames,
      allPresetItems,
      favoritePresetItems,
      favoritePresetNames,
      favoritePresetNamesSet,
      isFavorite,
      presetByName
    ]
  )

  return (
    <VisualizerCatalogContext.Provider value={catalogValue}>
      {children}
    </VisualizerCatalogContext.Provider>
  )
}

function VisualizerSourcesProvider({ children }) {
  const { queueState } = useSuper()
  const { playlists, playlistsLoaded, playlistsLoading, getSavedLists } = usePlaylists()
  const { directories, directoriesLoaded, directoriesLoading, getDirectories } = useMini()
  const {
    cycleDurationMs,
    presetSource,
    presetLists,
    sourceAssociations,
    visualizerLoaded
  } = useRequiredContext(VisualizerStoreContext, 'VisualizerSourcesProvider')

  useEffect(() => {
    if (!playlistsLoaded && !playlistsLoading) {
      void getSavedLists()
    }

    if (!directoriesLoaded && !directoriesLoading) {
      void getDirectories()
    }
  }, [
    directoriesLoaded,
    directoriesLoading,
    getDirectories,
    getSavedLists,
    playlistsLoaded,
    playlistsLoading
  ])

  const activePlaybackSource = useMemo(
    () => normalizePlaybackSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const activeSourceKey = useMemo(() => getSourceKey(activePlaybackSource), [activePlaybackSource])

  const activePresetList = useMemo(() => {
    const activeListId = sourceAssociations[activeSourceKey]

    if (!activeListId) {
      return null
    }

    return presetLists.find((list) => list.id === activeListId) || null
  }, [activeSourceKey, presetLists, sourceAssociations])

  const selectedPresetSourceList = useMemo(() => {
    if (presetSource.mode !== 'list' || !presetSource.listId) {
      return null
    }

    return presetLists.find((list) => list.id === presetSource.listId) || null
  }, [presetLists, presetSource.listId, presetSource.mode])

  const availableAssociationSources = useMemo(
    () => buildAssociationSources(playlists, directories),
    [directories, playlists]
  )

  const sourcesValue = useMemo(
    () => ({
      cycleDurationMs,
      presetSource,
      presetLists,
      sourceAssociations,
      activePlaybackSource,
      activeSourceKey,
      activePresetList,
      selectedPresetSourceList,
      availableAssociationSources,
      visualizerLoaded
    }),
    [
      activePlaybackSource,
      activePresetList,
      activeSourceKey,
      availableAssociationSources,
      cycleDurationMs,
      presetLists,
      presetSource,
      selectedPresetSourceList,
      sourceAssociations,
      visualizerLoaded
    ]
  )

  return (
    <VisualizerSourcesContext.Provider value={sourcesValue}>
      {children}
    </VisualizerSourcesContext.Provider>
  )
}

function VisualizerPlaybackProvider({ children }) {
  const { cycleDurationMs, presetSource } = useRequiredContext(
    VisualizerStoreContext,
    'VisualizerPlaybackProvider'
  )
  const { activePresetItems, activePresetNames } = useVisualizerCatalog()
  const [isShuffled, setIsShuffled] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState([])
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0)
  const [isPresetPaused, setIsPresetPaused] = useState(false)
  const presetIntervalRef = useRef(null)

  const toggleShuffle = useCallback(() => {
    setIsShuffled((previousValue) => {
      const nextValue = !previousValue
      setShuffledOrder(nextValue ? shuffleArray(activePresetNames) : [])
      return nextValue
    })
  }, [activePresetNames])

  useEffect(() => {
    setIsShuffled(false)
    setShuffledOrder([])
  }, [activePresetNames])

  const currentOrder = useMemo(() => {
    if (isShuffled) {
      return shuffledOrder
    }
    return activePresetNames
  }, [activePresetNames, isShuffled, shuffledOrder])

  const currentPresetName = currentOrder[currentPresetIndex] || ''

  useEffect(() => {
    if (currentOrder.length > 0 && (!currentPresetName || !currentOrder.includes(currentPresetName))) {
      setCurrentPresetIndex(0)
    }
  }, [currentOrder, currentPresetName, isShuffled, presetSource])

  const nextPreset = useCallback(() => {
    if (currentOrder.length === 0) return
    setCurrentPresetIndex((previousValue) => (previousValue + 1) % currentOrder.length)
  }, [currentOrder.length])

  const prevPreset = useCallback(() => {
    if (currentOrder.length === 0) return
    setCurrentPresetIndex(
      (previousValue) => (previousValue - 1 + currentOrder.length) % currentOrder.length
    )
  }, [currentOrder.length])

  const togglePresetPause = useCallback(() => {
    setIsPresetPaused((previousValue) => !previousValue)
  }, [])

  useEffect(() => {
    if (!isPresetPaused && currentOrder.length > 0) {
      if (presetIntervalRef.current) {
        clearInterval(presetIntervalRef.current)
      }

      presetIntervalRef.current = window.setInterval(() => {
        nextPreset()
      }, cycleDurationMs)
    }

    return () => {
      if (presetIntervalRef.current !== null) {
        clearInterval(presetIntervalRef.current)
        presetIntervalRef.current = null
      }
    }
  }, [cycleDurationMs, currentOrder, isPresetPaused, nextPreset])

  const setPresetIndex = useCallback(
    (index) => {
      if (index >= 0 && index < currentOrder.length) {
        setCurrentPresetIndex(index)
      }
    },
    [currentOrder.length]
  )

  const setPresetByName = useCallback(
    (name) => {
      const index = currentOrder.indexOf(name)
      if (index >= 0) {
        setCurrentPresetIndex(index)
      }
    },
    [currentOrder]
  )

  const playbackValue = useMemo(
    () => ({
      currentPresetName,
      currentPresetIndex,
      allPresets: currentOrder,
      activePresetItems,
      isPresetPaused,
      isShuffled,
      nextPreset,
      prevPreset,
      togglePresetPause,
      toggleShuffle,
      setPresetIndex,
      setPresetByName
    }),
    [
      activePresetItems,
      currentOrder,
      currentPresetIndex,
      currentPresetName,
      isPresetPaused,
      isShuffled,
      nextPreset,
      prevPreset,
      setPresetByName,
      setPresetIndex,
      togglePresetPause,
      toggleShuffle
    ]
  )

  return (
    <VisualizerPlaybackContext.Provider value={playbackValue}>
      {children}
    </VisualizerPlaybackContext.Provider>
  )
}

function VisualizerActionsProvider({ children }) {
  const store = useRequiredContext(VisualizerStoreContext, 'VisualizerActionsProvider')
  const storeApi = useRequiredContext(VisualizerStoreApiContext, 'VisualizerActionsProvider')
  const { activePlaybackSource, activeSourceKey } = useVisualizerSources()
  const storeRef = useLatestRef(store)
  const sourceRef = useLatestRef({ activePlaybackSource, activeSourceKey })
  const {
    applyPersistedState,
    setFavorites,
    setCycleDurationMsState,
    setPresetSourceState,
    setPresetLists,
    setSourceAssociations
  } = storeApi

  const setCycleDurationMs = useCallback(
    async (nextValue) => {
      const nextDuration = Number(nextValue)
      if (!Number.isFinite(nextDuration)) {
        return
      }

      const previousDuration = storeRef.current.cycleDurationMs
      setCycleDurationMsState(nextDuration)

      try {
        const response = await visualizerService.updateVisualizerSettings({
          cycleDurationMs: nextDuration
        })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to save visualizer cycle duration:', error)
        setCycleDurationMsState(previousDuration)
      }
    },
    [applyPersistedState, setCycleDurationMsState, storeRef]
  )

  const setPresetSource = useCallback(
    async (nextSource) => {
      const normalizedSource = normalizePresetSource(nextSource)
      const previousSource = storeRef.current.presetSource
      setPresetSourceState(normalizedSource)

      try {
        const response = await visualizerService.updateVisualizerSettings({
          presetSource: normalizedSource
        })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to save visualizer preset source:', error)
        setPresetSourceState(previousSource)
      }
    },
    [applyPersistedState, setPresetSourceState, storeRef]
  )

  const toggleFavorite = useCallback(
    async (presetName) => {
      if (!ALL_PRESET_KEYS.includes(presetName)) {
        return
      }

      const previousFavorites = storeRef.current.favorites

      setFavorites((currentFavorites) => {
        const isFavoritePreset = currentFavorites.includes(presetName)
        return isFavoritePreset
          ? currentFavorites.filter((name) => name !== presetName)
          : [...currentFavorites, presetName]
      })

      try {
        const response = await visualizerService.toggleFavorite(presetName)
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to toggle visualizer favorite:', error)
        setFavorites(previousFavorites)
      }
    },
    [applyPersistedState, setFavorites, storeRef]
  )

  const createPresetList = useCallback(
    async (name) => {
      const trimmedName = String(name || '').trim() || 'Nueva lista'
      const timestamp = Date.now()
      const optimisticList = {
        id: createStableId('preset-list'),
        name: trimmedName,
        presetNames: [],
        createdAt: timestamp,
        updatedAt: timestamp
      }

      setPresetLists((currentLists) => [...currentLists, optimisticList])

      try {
        const response = await visualizerService.createList(trimmedName)
        applyPersistedState(response.state)
        return response.list
      } catch (error) {
        console.warn('Failed to create visualizer preset list:', error)
        setPresetLists((currentLists) => currentLists.filter((list) => list.id !== optimisticList.id))
        return null
      }
    },
    [applyPersistedState, setPresetLists]
  )

  const renamePresetList = useCallback(
    async (listId, name) => {
      const trimmedName = String(name || '').trim()

      if (!listId || !trimmedName) {
        return
      }

      const previousLists = storeRef.current.presetLists

      setPresetLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? {
                ...list,
                name: trimmedName,
                updatedAt: Date.now()
              }
            : list
        )
      )

      try {
        const response = await visualizerService.renameList({ listId, name: trimmedName })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to rename visualizer preset list:', error)
        setPresetLists(previousLists)
      }
    },
    [applyPersistedState, setPresetLists, storeRef]
  )

  const deletePresetList = useCallback(
    async (listId) => {
      if (!listId) {
        return
      }

      const previousLists = storeRef.current.presetLists
      const previousAssociations = storeRef.current.sourceAssociations
      const previousSource = storeRef.current.presetSource

      setPresetLists((currentLists) => currentLists.filter((list) => list.id !== listId))
      setSourceAssociations((currentAssociations) => {
        const nextAssociations = {}

        Object.entries(currentAssociations).forEach(([sourceKey, associatedListId]) => {
          if (associatedListId !== listId) {
            nextAssociations[sourceKey] = associatedListId
          }
        })

        return nextAssociations
      })

      if (previousSource.mode === 'list' && previousSource.listId === listId) {
        setPresetSourceState(DEFAULT_SOURCE)
      }

      try {
        const response = await visualizerService.deleteList(listId)
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to delete visualizer preset list:', error)
        setPresetLists(previousLists)
        setSourceAssociations(previousAssociations)
        setPresetSourceState(previousSource)
      }
    },
    [
      applyPersistedState,
      setPresetLists,
      setPresetSourceState,
      setSourceAssociations,
      storeRef
    ]
  )

  useEffect(() => {
    setPresetSourceState((currentSource) => {
      const normalizedCurrentSource = normalizePresetSource(currentSource)

      if (
        normalizedCurrentSource.mode === 'list' &&
        normalizedCurrentSource.listId &&
        !storeRef.current.presetLists.some((list) => list.id === normalizedCurrentSource.listId)
      ) {
        return DEFAULT_SOURCE
      }

      return normalizedCurrentSource
    })
  }, [setPresetSourceState, store.presetLists, storeRef])

  const togglePresetInList = useCallback(
    async (listId, presetName) => {
      if (!listId || !ALL_PRESET_KEYS.includes(presetName)) {
        return
      }

      const previousLists = storeRef.current.presetLists

      setPresetLists((currentLists) =>
        currentLists.map((list) => {
          if (list.id !== listId) {
            return list
          }

          const hasPreset = list.presetNames.includes(presetName)
          return {
            ...list,
            presetNames: hasPreset
              ? list.presetNames.filter((name) => name !== presetName)
              : [...list.presetNames, presetName],
            updatedAt: Date.now()
          }
        })
      )

      try {
        const response = await visualizerService.togglePresetInList({ listId, presetName })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to toggle preset in visualizer list:', error)
        setPresetLists(previousLists)
      }
    },
    [applyPersistedState, setPresetLists, storeRef]
  )

  const associateActiveSource = useCallback(
    async (listId) => {
      const { activePlaybackSource: currentSource } = sourceRef.current
      if (!currentSource?.type || !currentSource?.id || !listId) {
        return
      }

      const sourceKey = getSourceKey(currentSource)
      const previousAssociations = storeRef.current.sourceAssociations

      setSourceAssociations((currentAssociations) => ({
        ...currentAssociations,
        [sourceKey]: listId
      }))

      try {
        const response = await visualizerService.associateSource({
          source: currentSource,
          listId
        })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to associate active visualizer source:', error)
        setSourceAssociations(previousAssociations)
      }
    },
    [applyPersistedState, setSourceAssociations, sourceRef, storeRef]
  )

  const associateSourceToList = useCallback(
    async (source, listId) => {
      if (!source?.type || !source?.id || !listId) {
        return
      }

      const sourceKey = getSourceKey(source)

      if (!sourceKey) {
        return
      }

      const previousAssociations = storeRef.current.sourceAssociations

      setSourceAssociations((currentAssociations) => ({
        ...currentAssociations,
        [sourceKey]: listId
      }))

      try {
        const response = await visualizerService.associateSource({ source, listId })
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to associate visualizer source:', error)
        setSourceAssociations(previousAssociations)
      }
    },
    [applyPersistedState, setSourceAssociations, storeRef]
  )

  const removeActiveSourceAssociation = useCallback(async () => {
    const { activePlaybackSource: currentSource, activeSourceKey: currentSourceKey } = sourceRef.current

    if (!currentSourceKey || !currentSource?.type || !currentSource?.id) {
      return
    }

    const previousAssociations = storeRef.current.sourceAssociations

    setSourceAssociations((currentAssociations) => {
      if (!Object.prototype.hasOwnProperty.call(currentAssociations, currentSourceKey)) {
        return currentAssociations
      }

      const nextAssociations = { ...currentAssociations }
      delete nextAssociations[currentSourceKey]
      return nextAssociations
    })

    try {
      const response = await visualizerService.removeSourceAssociation(currentSource)
      applyPersistedState(response.state)
    } catch (error) {
      console.warn('Failed to remove active visualizer source association:', error)
      setSourceAssociations(previousAssociations)
    }
  }, [applyPersistedState, setSourceAssociations, sourceRef, storeRef])

  const removeSourceAssociation = useCallback(
    async (source) => {
      const sourceKey = getSourceKey(source)

      if (!sourceKey) {
        return
      }

      const previousAssociations = storeRef.current.sourceAssociations

      setSourceAssociations((currentAssociations) => {
        if (!Object.prototype.hasOwnProperty.call(currentAssociations, sourceKey)) {
          return currentAssociations
        }

        const nextAssociations = { ...currentAssociations }
        delete nextAssociations[sourceKey]
        return nextAssociations
      })

      try {
        const response = await visualizerService.removeSourceAssociation(source)
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to remove visualizer source association:', error)
        setSourceAssociations(previousAssociations)
      }
    },
    [applyPersistedState, setSourceAssociations, storeRef]
  )

  const pruneMissingSourceAssociations = useCallback(
    async (existingSources) => {
      if (!(existingSources instanceof Set)) {
        return
      }

      const previousAssociations = storeRef.current.sourceAssociations

      setSourceAssociations((currentAssociations) => {
        const nextAssociations = {}

        Object.entries(currentAssociations).forEach(([sourceKey, listId]) => {
          if (sourceKey === 'favorites:favorites' || existingSources.has(sourceKey)) {
            nextAssociations[sourceKey] = listId
          }
        })

        return nextAssociations
      })

      try {
        const response = await visualizerService.pruneSourceAssociations(Array.from(existingSources))
        applyPersistedState(response.state)
      } catch (error) {
        console.warn('Failed to prune visualizer source associations:', error)
        setSourceAssociations(previousAssociations)
      }
    },
    [applyPersistedState, setSourceAssociations, storeRef]
  )

  const settingsActionsValue = useMemo(
    () => ({
      setCycleDurationMs,
      setPresetSource
    }),
    [setCycleDurationMs, setPresetSource]
  )

  const favoriteActionsValue = useMemo(
    () => ({
      toggleFavorite
    }),
    [toggleFavorite]
  )

  const listActionsValue = useMemo(
    () => ({
      createPresetList,
      renamePresetList,
      deletePresetList,
      togglePresetInList,
      associateActiveSource,
      associateSourceToList,
      removeActiveSourceAssociation,
      removeSourceAssociation,
      pruneMissingSourceAssociations
    }),
    [
      associateActiveSource,
      associateSourceToList,
      createPresetList,
      deletePresetList,
      pruneMissingSourceAssociations,
      removeActiveSourceAssociation,
      removeSourceAssociation,
      renamePresetList,
      togglePresetInList
    ]
  )

  return (
    <VisualizerSettingsActionsContext.Provider value={settingsActionsValue}>
      <VisualizerFavoriteActionsContext.Provider value={favoriteActionsValue}>
        <VisualizerListActionsContext.Provider value={listActionsValue}>
          {children}
        </VisualizerListActionsContext.Provider>
      </VisualizerFavoriteActionsContext.Provider>
    </VisualizerSettingsActionsContext.Provider>
  )
}

export function VisualizerProvider({ children }) {
  return (
    <VisualizerStoreProvider>
      <VisualizerSourcesProvider>
        <VisualizerCatalogProvider>
          <VisualizerPlaybackProvider>
            <VisualizerActionsProvider>{children}</VisualizerActionsProvider>
          </VisualizerPlaybackProvider>
        </VisualizerCatalogProvider>
      </VisualizerSourcesProvider>
    </VisualizerStoreProvider>
  )
}

export function useVisualizerPlayback() {
  return useRequiredContext(VisualizerPlaybackContext, 'useVisualizerPlayback')
}

export function useVisualizerCatalog() {
  return useRequiredContext(VisualizerCatalogContext, 'useVisualizerCatalog')
}

export function useVisualizerSources() {
  return useRequiredContext(VisualizerSourcesContext, 'useVisualizerSources')
}

export function useVisualizerSettingsActions() {
  return useRequiredContext(VisualizerSettingsActionsContext, 'useVisualizerSettingsActions')
}

export function useVisualizerListActions() {
  return useRequiredContext(VisualizerListActionsContext, 'useVisualizerListActions')
}

export function useVisualizerFavoriteActions() {
  return useRequiredContext(VisualizerFavoriteActionsContext, 'useVisualizerFavoriteActions')
}
