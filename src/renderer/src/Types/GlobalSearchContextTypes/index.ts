import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react'

import type {
  DirectorySearchItem
} from '../../../../main/Types/filehandlers.ts'
import type { PlaylistSearchItem } from '../../../../main/Types/playlistHandlers.ts'
import type { SearchSongItem } from '../../../../main/Types/likeHandlers.ts'
import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'

export type GlobalSearchProviderProps = {
  children: ReactNode
}

export type GlobalSearchFilterId =
  | 'directory'
  | 'playlist'
  | 'artist'
  | 'name'
  | 'configuration'

export type GlobalSearchFilters = Record<GlobalSearchFilterId, boolean>

export type GlobalSearchCategoryId =
  | 'songs'
  | 'playlists'
  | 'directories'
  | 'configuration'

export type GlobalSearchCategoryState<T> = {
  items: T[]
  loading: boolean
  hasMore: boolean
  page: number
  total: number
}

export type GlobalSearchSettingItem = {
  type: 'setting'
  id: string
  title: string
  subtitle: string
  meta: string
  actionPayload: {
    route: string
  }
}

export type GlobalSearchSectionItem =
  | SearchSongItem
  | PlaylistSearchItem
  | DirectorySearchItem
  | GlobalSearchSettingItem

export type GlobalSearchSection = {
  id: GlobalSearchCategoryId
  title: string
  enabled: boolean
  items: GlobalSearchSectionItem[]
  loading: boolean
  hasMore: boolean
  total: number
  onLoadMore?: () => void
}

export type GlobalSearchTranslator = (
  key: string,
  params?: Record<string, unknown>,
  fallback?: string
) => string

export type GlobalSearchInvoker = <T>(channel: string, ...args: unknown[]) => Promise<T>

export type GlobalSearchContextValue = {
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  filters: GlobalSearchFilters
  toggleFilter: (filterId: GlobalSearchFilterId) => void
  sections: GlobalSearchSection[]
  hasQuery: boolean
  handleSongSelect: (song: SearchSongItem) => void
  handlePlaylistSelect: (item: PlaylistSearchItem) => Promise<void>
  handleDirectorySelect: (item: DirectorySearchItem) => Promise<void>
  handleSettingSelect: (item: GlobalSearchSettingItem) => void
}

export type GlobalSearchQueryDependencies = {
  debouncedQuery: string
  filters: GlobalSearchFilters
  songs: GlobalSearchCategoryState<SearchSongItem>
  playlists: GlobalSearchCategoryState<PlaylistSearchItem>
  directories: GlobalSearchCategoryState<DirectorySearchItem>
  setSongs: Dispatch<SetStateAction<GlobalSearchCategoryState<SearchSongItem>>>
  setPlaylists: Dispatch<SetStateAction<GlobalSearchCategoryState<PlaylistSearchItem>>>
  setDirectories: Dispatch<SetStateAction<GlobalSearchCategoryState<DirectorySearchItem>>>
  songsRequestRef: MutableRefObject<number>
  playlistsRequestRef: MutableRefObject<number>
  directoriesRequestRef: MutableRefObject<number>
  invoke: GlobalSearchInvoker
}

export type GlobalSearchQueryActions = {
  runSongsSearch: (page?: number) => Promise<void>
  runPlaylistsSearch: (page?: number) => Promise<void>
  runDirectoriesSearch: (page?: number) => Promise<void>
  loadMoreSongs: () => void
  loadMorePlaylists: () => void
  loadMoreDirectories: () => void
}

export type GlobalSearchActionDependencies = {
  closeSearch: () => void
  navigate: (path: string) => void
  appendToQueueAndPlay: (song: AudioFileInfo) => void
  handleQueueAndPlay: (
    song?: AudioFileInfo,
    index?: number,
    filePath?: string,
    shouldNavigate?: boolean
  ) => Promise<void>
  openDirectoryQueue: (directoryPath: string) => Promise<AudioFileInfo[]>
}

export type GlobalSearchActions = Pick<
  GlobalSearchContextValue,
  | 'handleSongSelect'
  | 'handlePlaylistSelect'
  | 'handleDirectorySelect'
  | 'handleSettingSelect'
>
