import type { Dispatch, SetStateAction } from 'react'

import type { DirectorySearchPage, DirectorySearchItem } from '../../../../main/Types/filehandlers.ts'
import type { PlaylistSearchItem, PlaylistSearchPage } from '../../../../main/Types/playlistHandlers.ts'
import type { SearchSongItem, SearchSongsPage } from '../../../../main/Types/likeHandlers.ts'
import type {
  GlobalSearchCategoryState,
  GlobalSearchQueryActions,
  GlobalSearchQueryDependencies
} from '../../Types/GlobalSearchContextTypes/index.ts'
import {
  DIRECTORIES_PAGE_SIZE,
  PLAYLISTS_PAGE_SIZE,
  SONGS_PAGE_SIZE
} from './searchConfig.ts'
import { createCategoryState, isSearchPageResponse, normalizeSearchQuery } from './searchUtils.ts'

function resetCategory<T>(
  setCategoryState: Dispatch<SetStateAction<GlobalSearchCategoryState<T>>>
): void {
  setCategoryState(createCategoryState<T>())
}

export function createGlobalSearchQueries({
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
}: GlobalSearchQueryDependencies): GlobalSearchQueryActions {
  const runSongsSearch = async (page = 1): Promise<void> => {
    const requestId = songsRequestRef.current + 1
    songsRequestRef.current = requestId
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || (!filters.name && !filters.artist)) {
      resetCategory(setSongs)
      return
    }

    setSongs((currentState) => ({ ...currentState, loading: true }))

    try {
      const response = await invoke<SearchSongsPage>('search-songs-page', {
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

      if (!isSearchPageResponse<SearchSongItem>(response)) {
        throw new Error('Invalid songs search response')
      }

      setSongs((currentState) => ({
        items: page === 1 ? response.items : [...currentState.items, ...response.items],
        loading: false,
        hasMore: response.hasMore,
        page: response.page || page,
        total: response.total
      }))
    } catch (error) {
      if (requestId !== songsRequestRef.current) {
        return
      }

      console.error('Global search songs failed:', error)
      resetCategory(setSongs)
    }
  }

  const runPlaylistsSearch = async (page = 1): Promise<void> => {
    const requestId = playlistsRequestRef.current + 1
    playlistsRequestRef.current = requestId
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || !filters.playlist) {
      resetCategory(setPlaylists)
      return
    }

    setPlaylists((currentState) => ({ ...currentState, loading: true }))

    try {
      const response = await invoke<PlaylistSearchPage>('search-playlists-page', {
        query: normalizedQuery,
        page,
        pageSize: PLAYLISTS_PAGE_SIZE
      })

      if (requestId !== playlistsRequestRef.current) {
        return
      }

      if (!isSearchPageResponse<PlaylistSearchItem>(response)) {
        throw new Error('Invalid playlists search response')
      }

      setPlaylists((currentState) => ({
        items: page === 1 ? response.items : [...currentState.items, ...response.items],
        loading: false,
        hasMore: response.hasMore,
        page: response.page || page,
        total: response.total
      }))
    } catch (error) {
      if (requestId !== playlistsRequestRef.current) {
        return
      }

      console.error('Global search playlists failed:', error)
      resetCategory(setPlaylists)
    }
  }

  const runDirectoriesSearch = async (page = 1): Promise<void> => {
    const requestId = directoriesRequestRef.current + 1
    directoriesRequestRef.current = requestId
    const normalizedQuery = normalizeSearchQuery(debouncedQuery)

    if (!normalizedQuery || !filters.directory) {
      resetCategory(setDirectories)
      return
    }

    setDirectories((currentState) => ({ ...currentState, loading: true }))

    try {
      const response = await invoke<DirectorySearchPage>('search-directories-page', {
        query: normalizedQuery,
        page,
        pageSize: DIRECTORIES_PAGE_SIZE
      })

      if (requestId !== directoriesRequestRef.current) {
        return
      }

      if (!isSearchPageResponse<DirectorySearchItem>(response)) {
        throw new Error('Invalid directories search response')
      }

      setDirectories((currentState) => ({
        items: page === 1 ? response.items : [...currentState.items, ...response.items],
        loading: false,
        hasMore: response.hasMore,
        page: response.page || page,
        total: response.total
      }))
    } catch (error) {
      if (requestId !== directoriesRequestRef.current) {
        return
      }

      console.error('Global search directories failed:', error)
      resetCategory(setDirectories)
    }
  }

  const loadMoreSongs = (): void => {
    if (songs.loading || !songs.hasMore) {
      return
    }

    void runSongsSearch(songs.page + 1)
  }

  const loadMorePlaylists = (): void => {
    if (playlists.loading || !playlists.hasMore) {
      return
    }

    void runPlaylistsSearch(playlists.page + 1)
  }

  const loadMoreDirectories = (): void => {
    if (directories.loading || !directories.hasMore) {
      return
    }

    void runDirectoriesSearch(directories.page + 1)
  }

  return {
    runSongsSearch,
    runPlaylistsSearch,
    runDirectoriesSearch,
    loadMoreSongs,
    loadMorePlaylists,
    loadMoreDirectories
  }
}
