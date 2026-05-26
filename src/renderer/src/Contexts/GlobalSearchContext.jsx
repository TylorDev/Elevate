import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueue } from './QueueContext'
import { useI18n } from './I18nContext'

const GlobalSearchContext = createContext(null)

const SONGS_PAGE_SIZE = 50
const PLAYLISTS_PAGE_SIZE = 30
const DIRECTORIES_PAGE_SIZE = 30

function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

function createCategoryState() {
  return {
    items: [],
    loading: false,
    hasMore: false,
    page: 0,
    total: 0
  }
}

function filterSettingItems(query, settingItems) {
  if (!query) {
    return settingItems
  }

  const loweredQuery = query.toLocaleLowerCase()
  return settingItems.filter((item) =>
    `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(loweredQuery)
  )
}

export function GlobalSearchProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const { appendToQueueAndPlay, handleQueueAndPlay, openDirectoryQueue } = useQueue()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState({
    directory: true,
    playlist: true,
    artist: true,
    name: true,
    configuration: false
  })
  const [songs, setSongs] = useState(createCategoryState)
  const [playlists, setPlaylists] = useState(createCategoryState)
  const [directories, setDirectories] = useState(createCategoryState)

  const songsRequestRef = useRef(0)
  const playlistsRequestRef = useRef(0)
  const directoriesRequestRef = useRef(0)

  const closeSearch = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openSearch = useCallback(() => {
    setIsOpen(true)
  }, [])

  const toggleSearch = useCallback(() => {
    setIsOpen((currentValue) => !currentValue)
  }, [])

  const resetCategory = useCallback((setCategoryState) => {
    setCategoryState(createCategoryState())
  }, [])

  const runSongsSearch = useCallback(async (page = 1) => {
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || (!filters.name && !filters.artist)) {
      resetCategory(setSongs)
      return
    }

    songsRequestRef.current += 1
    const requestId = songsRequestRef.current

    setSongs((currentState) => ({
      ...currentState,
      loading: true
    }))

    try {
      const response = await window.electron.ipcRenderer.invoke('search-songs-page', {
        query: normalizedQuery,
        filters: {
          name: filters.name,
          artist: filters.artist
        },
        page,
        pageSize: SONGS_PAGE_SIZE
      })

      if (requestId !== songsRequestRef.current) {
        return
      }

      setSongs((currentState) => ({
        items: page === 1 ? response.items || [] : [...currentState.items, ...(response.items || [])],
        loading: false,
        hasMore: Boolean(response.hasMore),
        page: response.page || page,
        total: response.total || 0
      }))
    } catch (error) {
      if (requestId !== songsRequestRef.current) {
        return
      }

      console.error('Global search songs failed:', error)
      resetCategory(setSongs)
    }
  }, [debouncedQuery, filters.artist, filters.name, resetCategory])

  const runPlaylistsSearch = useCallback(async (page = 1) => {
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || !filters.playlist) {
      resetCategory(setPlaylists)
      return
    }

    playlistsRequestRef.current += 1
    const requestId = playlistsRequestRef.current

    setPlaylists((currentState) => ({
      ...currentState,
      loading: true
    }))

    try {
      const response = await window.electron.ipcRenderer.invoke('search-playlists-page', {
        query: normalizedQuery,
        page,
        pageSize: PLAYLISTS_PAGE_SIZE
      })

      if (requestId !== playlistsRequestRef.current) {
        return
      }

      setPlaylists((currentState) => ({
        items: page === 1 ? response.items || [] : [...currentState.items, ...(response.items || [])],
        loading: false,
        hasMore: Boolean(response.hasMore),
        page: response.page || page,
        total: response.total || 0
      }))
    } catch (error) {
      if (requestId !== playlistsRequestRef.current) {
        return
      }

      console.error('Global search playlists failed:', error)
      resetCategory(setPlaylists)
    }
  }, [debouncedQuery, filters.playlist, resetCategory])

  const runDirectoriesSearch = useCallback(async (page = 1) => {
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || !filters.directory) {
      resetCategory(setDirectories)
      return
    }

    directoriesRequestRef.current += 1
    const requestId = directoriesRequestRef.current

    setDirectories((currentState) => ({
      ...currentState,
      loading: true
    }))

    try {
      const response = await window.electron.ipcRenderer.invoke('search-directories-page', {
        query: normalizedQuery,
        page,
        pageSize: DIRECTORIES_PAGE_SIZE
      })

      if (requestId !== directoriesRequestRef.current) {
        return
      }

      setDirectories((currentState) => ({
        items: page === 1 ? response.items || [] : [...currentState.items, ...(response.items || [])],
        loading: false,
        hasMore: Boolean(response.hasMore),
        page: response.page || page,
        total: response.total || 0
      }))
    } catch (error) {
      if (requestId !== directoriesRequestRef.current) {
        return
      }

      console.error('Global search directories failed:', error)
      resetCategory(setDirectories)
    }
  }, [debouncedQuery, filters.directory, resetCategory])

  const loadMoreSongs = useCallback(() => {
    if (songs.loading || !songs.hasMore) {
      return
    }

    void runSongsSearch(songs.page + 1)
  }, [runSongsSearch, songs.hasMore, songs.loading, songs.page])

  const loadMorePlaylists = useCallback(() => {
    if (playlists.loading || !playlists.hasMore) {
      return
    }

    void runPlaylistsSearch(playlists.page + 1)
  }, [playlists.hasMore, playlists.loading, playlists.page, runPlaylistsSearch])

  const loadMoreDirectories = useCallback(() => {
    if (directories.loading || !directories.hasMore) {
      return
    }

    void runDirectoriesSearch(directories.page + 1)
  }, [directories.hasMore, directories.loading, directories.page, runDirectoriesSearch])

  const handleFilterToggle = useCallback((filterId) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterId]: !currentFilters[filterId]
    }))
  }, [])

  const handleSongSelect = useCallback((song) => {
    appendToQueueAndPlay(song)
    closeSearch()
  }, [appendToQueueAndPlay, closeSearch])

  const handlePlaylistSelect = useCallback(async (item) => {
    await handleQueueAndPlay(undefined, undefined, item?.path || item?.actionPayload?.path)
    closeSearch()
  }, [closeSearch, handleQueueAndPlay])

  const handleDirectorySelect = useCallback(async (item) => {
    await openDirectoryQueue(item?.path || item?.actionPayload?.path)
    closeSearch()
  }, [closeSearch, openDirectoryQueue])

  const handleSettingSelect = useCallback((item) => {
    navigate(item?.actionPayload?.route || '/settings')
    closeSearch()
  }, [closeSearch, navigate])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(normalizeSearchQuery(query))
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [query])

  useEffect(() => {
    closeSearch()
  }, [closeSearch, location.key])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!debouncedQuery) {
      resetCategory(setSongs)
      resetCategory(setPlaylists)
      resetCategory(setDirectories)
      return
    }

    void runSongsSearch(1)
    void runPlaylistsSearch(1)
    void runDirectoriesSearch(1)
  }, [
    debouncedQuery,
    filters.artist,
    filters.directory,
    filters.name,
    filters.playlist,
    isOpen,
    resetCategory,
    runDirectoriesSearch,
    runPlaylistsSearch,
    runSongsSearch
  ])

  const settingsItems = useMemo(() => {
    if (!filters.configuration) {
      return []
    }

    return filterSettingItems(debouncedQuery, settingItems)
  }, [debouncedQuery, filters.configuration, settingItems])

  const hasQuery = Boolean(debouncedQuery)

  const sections = useMemo(() => ([
    {
      id: 'songs',
      title: t('search.songs'),
      enabled: filters.name || filters.artist,
      items: songs.items,
      loading: songs.loading,
      hasMore: songs.hasMore,
      total: songs.total,
      onLoadMore: loadMoreSongs
    },
    {
      id: 'playlists',
      title: t('search.playlists'),
      enabled: filters.playlist && hasQuery,
      items: playlists.items,
      loading: playlists.loading,
      hasMore: playlists.hasMore,
      total: playlists.total,
      onLoadMore: loadMorePlaylists
    },
    {
      id: 'directories',
      title: t('search.directories'),
      enabled: filters.directory && hasQuery,
      items: directories.items,
      loading: directories.loading,
      hasMore: directories.hasMore,
      total: directories.total,
      onLoadMore: loadMoreDirectories
    },
    {
      id: 'configuration',
      title: t('search.configuration'),
      enabled: filters.configuration,
      items: settingsItems,
      loading: false,
      hasMore: false,
      total: settingsItems.length,
      onLoadMore: undefined
    }
  ]), [
    directories.hasMore,
    directories.items,
    directories.loading,
    directories.total,
    filters.artist,
    filters.configuration,
    filters.directory,
    filters.name,
    filters.playlist,
    hasQuery,
    loadMoreDirectories,
    loadMorePlaylists,
    loadMoreSongs,
    playlists.hasMore,
    playlists.items,
    playlists.loading,
    playlists.total,
    settingsItems,
    songs.hasMore,
    songs.items,
    songs.loading,
    songs.total,
    t
  ])

  const value = useMemo(() => ({
    isOpen,
    openSearch,
    closeSearch,
    toggleSearch,
    query,
    setQuery,
    filters,
    toggleFilter: handleFilterToggle,
    sections,
    hasQuery,
    handleSongSelect,
    handlePlaylistSelect,
    handleDirectorySelect,
    handleSettingSelect
  }), [
    closeSearch,
    filters,
    handleDirectorySelect,
    handleFilterToggle,
    handlePlaylistSelect,
    handleSettingSelect,
    handleSongSelect,
    hasQuery,
    isOpen,
    openSearch,
    query,
    sections,
    toggleSearch
  ])

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  )
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext)

  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider')
  }

  return context
}
  const settingItems = useMemo(() => [
    {
      type: 'setting',
      id: 'change-background',
      title: t('search.changeBackground'),
      subtitle: t('search.openVisualSettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    },
    {
      type: 'setting',
      id: 'primary-color',
      title: t('search.primaryColor'),
      subtitle: t('search.openColorSettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    },
    {
      type: 'setting',
      id: 'add-directory',
      title: t('search.addDirectory'),
      subtitle: t('search.openLibrarySettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    }
  ], [t])
