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

import type { SearchSongItem } from '../../../../main/Types/likeHandlers.ts'
import type { DirectorySearchItem } from '../../../../main/Types/filehandlers.ts'
import type { PlaylistSearchItem } from '../../../../main/Types/playlistHandlers.ts'
import type {
  GlobalSearchCategoryState,
  GlobalSearchContextValue,
  GlobalSearchFilterId,
  GlobalSearchFilters,
  GlobalSearchInvoker,
  GlobalSearchProviderProps,
  GlobalSearchSection,
  GlobalSearchTranslator
} from '../../Types/GlobalSearchContextTypes/index.ts'
import { useI18n } from '../I18nContext'
import { useQueue } from '../QueueContext'
import { createGlobalSearchActions } from './searchActions.ts'
import { createSettingItems } from './searchConfig.ts'
import { createGlobalSearchQueries } from './searchQueries.ts'
import { createCategoryState, filterSettingItems, normalizeSearchQuery } from './searchUtils.ts'

export const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null)

export function getGlobalSearchContextValue(
  context: GlobalSearchContextValue | null
): GlobalSearchContextValue {
  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider')
  }

  return context
}

const INITIAL_FILTERS: GlobalSearchFilters = {
  directory: true,
  playlist: true,
  artist: true,
  name: true,
  configuration: false
}

export function GlobalSearchProvider({ children }: GlobalSearchProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n() as { t: GlobalSearchTranslator }
  const { appendToQueueAndPlay, handleQueueAndPlay, openDirectoryQueue } = useQueue()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState<GlobalSearchFilters>(INITIAL_FILTERS)
  const [songs, setSongs] = useState<GlobalSearchCategoryState<SearchSongItem>>(() =>
    createCategoryState<SearchSongItem>()
  )
  const [playlists, setPlaylists] = useState<GlobalSearchCategoryState<PlaylistSearchItem>>(() =>
    createCategoryState<PlaylistSearchItem>()
  )
  const [directories, setDirectories] = useState<GlobalSearchCategoryState<DirectorySearchItem>>(
    () => createCategoryState<DirectorySearchItem>()
  )

  const songsRequestRef = useRef(0)
  const playlistsRequestRef = useRef(0)
  const directoriesRequestRef = useRef(0)

  const settingItems = useMemo(() => createSettingItems(t), [t])

  const invoke = useCallback<GlobalSearchInvoker>(
    async <T,>(channel, ...args) => {
      const response = await window.electron.ipcRenderer.invoke(channel, ...args)
      return response as T
    },
    []
  )

  const openSearch = useCallback((): void => {
    setIsOpen(true)
  }, [])

  const closeSearch = useCallback((): void => {
    setIsOpen(false)
  }, [])

  const toggleSearch = useCallback((): void => {
    setIsOpen((currentValue) => !currentValue)
  }, [])

  const toggleFilter = useCallback((filterId: GlobalSearchFilterId): void => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterId]: !currentFilters[filterId]
    }))
  }, [])

  const queries = useMemo(
    () =>
      createGlobalSearchQueries({
        debouncedQuery,
        filters,
        songs,
        playlists,
        directories,
        setSongs,
        setPlaylists,
        setDirectories,
        songsRequestRef,
        playlistsRequestRef,
        directoriesRequestRef,
        invoke
      }),
    [
      debouncedQuery,
      directories,
      filters,
      invoke,
      playlists,
      songs
    ]
  )
  const queriesRef = useRef(queries)
  queriesRef.current = queries

  const actions = useMemo(
    () =>
      createGlobalSearchActions({
        closeSearch,
        navigate,
        appendToQueueAndPlay,
        handleQueueAndPlay,
        openDirectoryQueue
      }),
    [
      appendToQueueAndPlay,
      closeSearch,
      handleQueueAndPlay,
      navigate,
      openDirectoryQueue
    ]
  )

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

    void queriesRef.current.runSongsSearch(1)
    void queriesRef.current.runPlaylistsSearch(1)
    void queriesRef.current.runDirectoriesSearch(1)
  }, [
    debouncedQuery,
    filters.artist,
    filters.directory,
    filters.name,
    filters.playlist,
    isOpen
  ])

  const settingsItems = useMemo(
    () => (filters.configuration ? filterSettingItems(debouncedQuery, settingItems) : []),
    [debouncedQuery, filters.configuration, settingItems]
  )

  const hasQuery = Boolean(debouncedQuery)

  const sections = useMemo<GlobalSearchSection[]>(
    () => [
      {
        id: 'songs',
        title: t('search.songs'),
        enabled: filters.name || filters.artist,
        items: songs.items,
        loading: songs.loading,
        hasMore: songs.hasMore,
        total: songs.total,
        onLoadMore: queries.loadMoreSongs
      },
      {
        id: 'playlists',
        title: t('search.playlists'),
        enabled: filters.playlist && hasQuery,
        items: playlists.items,
        loading: playlists.loading,
        hasMore: playlists.hasMore,
        total: playlists.total,
        onLoadMore: queries.loadMorePlaylists
      },
      {
        id: 'directories',
        title: t('search.directories'),
        enabled: filters.directory && hasQuery,
        items: directories.items,
        loading: directories.loading,
        hasMore: directories.hasMore,
        total: directories.total,
        onLoadMore: queries.loadMoreDirectories
      },
      {
        id: 'configuration',
        title: t('search.configuration'),
        enabled: filters.configuration,
        items: settingsItems,
        loading: false,
        hasMore: false,
        total: settingsItems.length
      }
    ],
    [
      directories,
      filters,
      hasQuery,
      playlists,
      queries,
      settingsItems,
      songs,
      t
    ]
  )

  const value = useMemo<GlobalSearchContextValue>(
    () => ({
      isOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      query,
      setQuery,
      filters,
      toggleFilter,
      sections,
      hasQuery,
      ...actions
    }),
    [
      actions,
      closeSearch,
      filters,
      hasQuery,
      isOpen,
      openSearch,
      query,
      sections,
      toggleFilter,
      toggleSearch
    ]
  )

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  )
}

export function useGlobalSearch(): GlobalSearchContextValue {
  return getGlobalSearchContextValue(useContext(GlobalSearchContext))
}
