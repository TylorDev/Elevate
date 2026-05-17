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

const VisualizerContext = createContext(null)

const PRESET_CATALOG = MINI.default || MINI
const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG)

const STORAGE_KEYS = {
  favorites: 'visualizerPresetFavorites',
  cycleDuration: 'visualizerCycleDurationMs',
  source: 'visualizerPresetSource',
  presetLists: 'visualizerPresetLists',
  sourceAssociations: 'visualizerPresetSourceAssociations'
}

const DEFAULT_CYCLE_DURATION = 6000
const DEFAULT_SOURCE = Object.freeze({
  mode: 'all',
  listId: null
})

function shuffleArray(array) {
  const shuffled = [...array]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled
}

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
  }
  return defaultValue
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error)
  }
}

export function createStableId(prefix) {
  if (globalThis?.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizePresetSource(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const mode = rawValue.mode === 'favorites' || rawValue.mode === 'list' ? rawValue.mode : 'all'
    const listId = typeof rawValue.listId === 'string' && rawValue.listId.trim() ? rawValue.listId : null

    if (mode === 'list') {
      return {
        mode,
        listId
      }
    }

    return {
      mode,
      listId: null
    }
  }

  if (rawValue === 'favorites') {
    return {
      mode: 'favorites',
      listId: null
    }
  }

  return {
    mode: 'all',
    listId: null
  }
}

export function normalizePlaybackSource(queueName) {
  if (typeof queueName !== 'string' || !queueName.trim()) {
    return null
  }

  if (queueName.startsWith('folder:')) {
    return {
      type: 'directory',
      id: queueName.slice('folder:'.length)
    }
  }

  if (queueName === 'favourites' || queueName === 'favorites') {
    return {
      type: 'favorites',
      id: 'favorites'
    }
  }

  return {
    type: 'playlist',
    id: queueName
  }
}

export function getSourceKey(source) {
  if (!source?.type || !source?.id) {
    return ''
  }

  return `${source.type}:${source.id}`
}

export function getSourceLabel(source) {
  if (!source?.type || !source?.id) {
    return 'Sin fuente activa'
  }

  if (source.type === 'favorites') {
    return 'Favoritos'
  }

  if (source.type === 'directory') {
    return `Directorio: ${source.id}`
  }

  return `Playlist: ${source.id}`
}

export function createPresetByNameMap(presetItems = []) {
  return new Map(presetItems.map((preset) => [preset.name, preset]))
}

export function mapPresetNamesToItems(presetNames = [], presetByName = new Map()) {
  return presetNames.map((presetName) => presetByName.get(presetName)).filter(Boolean)
}

function buildAssociationSources(playlists = [], directories = []) {
  const playlistSources = playlists.map((playlist) => ({
    type: 'playlist',
    id: playlist.path,
    label: playlist.nombre || playlist.path,
    sourceKey: `playlist:${playlist.path}`
  }))

  const directorySources = directories.map((directory) => ({
    type: 'directory',
    id: directory.path,
    label: directory.name || directory.path.split('\\').pop() || directory.path,
    sourceKey: `directory:${directory.path}`
  }))

  return [
    {
      type: 'favorites',
      id: 'favorites',
      label: 'Favoritos',
      sourceKey: 'favorites:favorites'
    },
    ...playlistSources,
    ...directorySources
  ]
}

export function VisualizerProvider({ children }) {
  const { queueState } = useSuper()
  const { playlists, playlistsLoaded, playlistsLoading, getSavedLists } = usePlaylists()
  const { directories, directoriesLoaded, directoriesLoading, getDirectories } = useMini()

  const activePlaybackSource = useMemo(
    () => normalizePlaybackSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const [favorites, setFavorites] = useState(() => loadFromStorage(STORAGE_KEYS.favorites, []))
  const [cycleDurationMs, setCycleDurationMs] = useState(() =>
    loadFromStorage(STORAGE_KEYS.cycleDuration, DEFAULT_CYCLE_DURATION)
  )
  const [presetSource, setPresetSource] = useState(() =>
    normalizePresetSource(loadFromStorage(STORAGE_KEYS.source, DEFAULT_SOURCE))
  )
  const [presetLists, setPresetLists] = useState(() => loadFromStorage(STORAGE_KEYS.presetLists, []))
  const [sourceAssociations, setSourceAssociations] = useState(() =>
    loadFromStorage(STORAGE_KEYS.sourceAssociations, {})
  )
  const [isShuffled, setIsShuffled] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState([])
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0)
  const [isPresetPaused, setIsPresetPaused] = useState(false)

  const presetIntervalRef = useRef(null)

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

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.favorites, favorites)
  }, [favorites])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.cycleDuration, cycleDurationMs)
  }, [cycleDurationMs])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.source, presetSource)
  }, [presetSource])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.presetLists, presetLists)
  }, [presetLists])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.sourceAssociations, sourceAssociations)
  }, [sourceAssociations])

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

  const toggleShuffle = useCallback(() => {
    setIsShuffled((previousValue) => {
      const nextValue = !previousValue
      if (nextValue) {
        setShuffledOrder(shuffleArray(activePresetNames))
      } else {
        setShuffledOrder([])
      }
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
    if (currentOrder.length > 0 && !currentOrder.includes(currentPresetName)) {
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

  const toggleFavorite = useCallback((presetName) => {
    setFavorites((previousFavorites) => {
      const isFavoritePreset = previousFavorites.includes(presetName)
      if (isFavoritePreset) {
        return previousFavorites.filter((name) => name !== presetName)
      }
      return [...previousFavorites, presetName]
    })
  }, [])

  const isFavorite = useCallback(
    (presetName) => favorites.includes(presetName),
    [favorites]
  )

  const createPresetList = useCallback((name) => {
    const trimmedName = String(name || '').trim() || 'Nueva lista'
    const timestamp = Date.now()
    const nextList = {
      id: createStableId('preset-list'),
      name: trimmedName,
      presetNames: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }

    setPresetLists((previousLists) => [...previousLists, nextList])
    return nextList
  }, [])

  const renamePresetList = useCallback((listId, name) => {
    const trimmedName = String(name || '').trim()

    if (!listId || !trimmedName) {
      return
    }

    setPresetLists((previousLists) =>
      previousLists.map((list) =>
        list.id === listId
          ? {
              ...list,
              name: trimmedName,
              updatedAt: Date.now()
            }
          : list
      )
    )
  }, [])

  const deletePresetList = useCallback((listId) => {
    if (!listId) {
      return
    }

    setPresetLists((previousLists) => previousLists.filter((list) => list.id !== listId))
    setSourceAssociations((previousAssociations) => {
      const nextAssociations = {}

      Object.entries(previousAssociations).forEach(([sourceKey, associatedListId]) => {
        if (associatedListId !== listId) {
          nextAssociations[sourceKey] = associatedListId
        }
      })

      return nextAssociations
    })
  }, [])

  useEffect(() => {
    setPresetSource((currentSource) => {
      const normalizedCurrentSource = normalizePresetSource(currentSource)

      if (
        normalizedCurrentSource.mode === 'list' &&
        normalizedCurrentSource.listId &&
        !presetLists.some((list) => list.id === normalizedCurrentSource.listId)
      ) {
        return DEFAULT_SOURCE
      }

      return normalizedCurrentSource
    })
  }, [presetLists])

  const togglePresetInList = useCallback((listId, presetName) => {
    if (!listId || !ALL_PRESET_KEYS.includes(presetName)) {
      return
    }

    setPresetLists((previousLists) =>
      previousLists.map((list) => {
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
  }, [])

  const associateActiveSource = useCallback(
    (listId) => {
      if (!activePlaybackSource?.type || !activePlaybackSource?.id || !listId) {
        return
      }

      const sourceKey = getSourceKey(activePlaybackSource)

      setSourceAssociations((previousAssociations) => ({
        ...previousAssociations,
        [sourceKey]: listId
      }))
    },
    [activePlaybackSource]
  )

  const associateSourceToList = useCallback((source, listId) => {
    if (!source?.type || !source?.id || !listId) {
      return
    }

    const sourceKey = getSourceKey(source)

    if (!sourceKey) {
      return
    }

    setSourceAssociations((previousAssociations) => ({
      ...previousAssociations,
      [sourceKey]: listId
    }))
  }, [])

  const removeActiveSourceAssociation = useCallback(() => {
    if (!activeSourceKey) {
      return
    }

    setSourceAssociations((previousAssociations) => {
      if (!Object.prototype.hasOwnProperty.call(previousAssociations, activeSourceKey)) {
        return previousAssociations
      }

      const nextAssociations = { ...previousAssociations }
      delete nextAssociations[activeSourceKey]
      return nextAssociations
    })
  }, [activeSourceKey])

  const removeSourceAssociation = useCallback((source) => {
    const sourceKey = getSourceKey(source)

    if (!sourceKey) {
      return
    }

    setSourceAssociations((previousAssociations) => {
      if (!Object.prototype.hasOwnProperty.call(previousAssociations, sourceKey)) {
        return previousAssociations
      }

      const nextAssociations = { ...previousAssociations }
      delete nextAssociations[sourceKey]
      return nextAssociations
    })
  }, [])

  const pruneMissingSourceAssociations = useCallback((existingSources) => {
    if (!(existingSources instanceof Set)) {
      return
    }

    setSourceAssociations((previousAssociations) => {
      const nextAssociations = {}

      Object.entries(previousAssociations).forEach(([sourceKey, listId]) => {
        if (sourceKey === 'favorites:favorites' || existingSources.has(sourceKey)) {
          nextAssociations[sourceKey] = listId
        }
      })

      return nextAssociations
    })
  }, [])

  const availableAssociationSources = useMemo(
    () => buildAssociationSources(playlists, directories),
    [directories, playlists]
  )

  const playback = useMemo(
    () => ({
      currentPresetName,
      currentPresetIndex,
      allPresets: currentOrder,
      isPresetPaused,
      isShuffled,
      cycleDurationMs
    }),
    [
      currentOrder,
      currentPresetIndex,
      currentPresetName,
      cycleDurationMs,
      isPresetPaused,
      isShuffled
    ]
  )

  const catalog = useMemo(
    () => ({
      allPresetItems,
      activePresetItems,
      favoritePresetItems,
      favoritePresetNames,
      favoritePresetNamesSet,
      presetByName
    }),
    [
      activePresetItems,
      allPresetItems,
      favoritePresetItems,
      favoritePresetNames,
      favoritePresetNamesSet,
      presetByName
    ]
  )

  const sources = useMemo(
    () => ({
      presetSource,
      presetLists,
      sourceAssociations,
      activePlaybackSource,
      activeSourceKey,
      activePresetList,
      selectedPresetSourceList,
      availableAssociationSources
    }),
    [
      activePlaybackSource,
      activePresetList,
      activeSourceKey,
      availableAssociationSources,
      presetLists,
      presetSource,
      selectedPresetSourceList,
      sourceAssociations
    ]
  )

  const actions = useMemo(
    () => ({
      nextPreset,
      prevPreset,
      togglePresetPause,
      setPresetIndex,
      setPresetByName,
      setCycleDurationMs,
      toggleShuffle,
      setPresetSource,
      toggleFavorite,
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
      nextPreset,
      prevPreset,
      pruneMissingSourceAssociations,
      removeActiveSourceAssociation,
      removeSourceAssociation,
      renamePresetList,
      setCycleDurationMs,
      setPresetByName,
      setPresetIndex,
      setPresetSource,
      toggleFavorite,
      togglePresetInList,
      togglePresetPause,
      toggleShuffle
    ]
  )

  const value = useMemo(
    () => ({
      ...playback,
      ...catalog,
      ...sources,
      ...actions,
      playback,
      catalog,
      sources,
      actions,
      isFavorite
    }),
    [actions, catalog, isFavorite, playback, sources]
  )

  return <VisualizerContext.Provider value={value}>{children}</VisualizerContext.Provider>
}

export function UseViz() {
  const context = useContext(VisualizerContext)

  if (!context) {
    throw new Error('UseViz must be used within a VisualizerProvider')
  }

  return context
}
