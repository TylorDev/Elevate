import type { Dispatch, ReactNode, SetStateAction } from 'react'

import type { AudioFileInfo, AudioFilesPage } from '../../../../main/Types/filehandlers.ts'
import type {
  AppendTracksToPlaylistResult,
  EnrichedPlaylist,
  ExportPlaylistResult,
  LoadListResult,
  PlaylistDeleteCompletedPayload,
  PlaylistDeleteQueuedResponse,
  PlaylistListPayload,
  SaveM3uRequest,
  UpdatePlaylistMetadataRequest,
  UpdatePlaylistMetadataResult
} from '../../../../main/Types/playlistHandlers.ts'
import type { ErrorResponse } from '../../../../main/Types/shared.ts'

export type PlaylistContextProps = {
  children: ReactNode
}

export type MutableRef<T> = {
  current: T
}

export type PlaylistTrackInput = {
  filePath?: unknown
  [key: string]: unknown
}

export type PlaylistOpenOptions = string | { filePath?: string | null }

export type PlaylistPaginationOptions = {
  pageSize?: number
  reset?: boolean
}

export type PlaylistLoadOptions = {
  force?: boolean
}

export type PlaylistSaveOptions = {
  nombre?: string
  targetDirectory?: string
  replacePath?: string | null
}

export type PlaylistExportOptions = {
  suggestedName?: string
}

export type PlaylistExportDirectoryOptions = {
  targetDirectory?: string
  nombre?: string
  replacePath?: string | null
}

export type PlaylistDeleteResponse =
  | PlaylistDeleteQueuedResponse
  | {
      success: false
      error: string
    }
  | {
      success: true
      queued: true
      path: string
    }
  | {
      success: true
      queued: true
      path: string
      duplicate: true
    }

export type PlaylistHistoryResponse =
  | {
      success: true
      message: string
      fileInfo: unknown
    }
  | {
      success: false
      message: string
      error: unknown
    }

export type PlaylistDeleteSnapshot = EnrichedPlaylist | null

export type RendererPlaylistListResult = PlaylistListPayload &
  Partial<Pick<ErrorResponse, 'success' | 'error' | 'message'>>

export type PlaylistDeleteDependencies = {
  invoke: PlaylistIpcInvoker
  playlistsRef: MutableRef<EnrichedPlaylist[]>
  pendingDeletesRef: MutableRef<Map<string, PlaylistDeleteSnapshot>>
  pendingJobsRef: MutableRef<Map<string, string>>
  processedJobsRef: MutableRef<Set<string>>
  setPlaylists: Dispatch<SetStateAction<EnrichedPlaylist[]>>
  setPlaylistsLoaded: Dispatch<SetStateAction<boolean>>
  setPlaylistsLastLoadedAt: Dispatch<SetStateAction<number | null>>
  setDeletingPlaylistPaths: Dispatch<SetStateAction<string[]>>
  refreshPlaylists: () => Promise<EnrichedPlaylist[] | null>
  notify: PlaylistToastNotifier
  translate: PlaylistTranslator
}

export type PlaylistMutationDependencies = PlaylistDeleteDependencies & {
  removeTrack: (playlistPath: string, index: number) => Promise<unknown>
  addSong: (playlistPath: string, track: unknown) => Promise<unknown>
}

export type PlaylistFileDependencies = {
  invoke: PlaylistIpcInvoker
  refreshPlaylists: () => void
  notify: PlaylistToastNotifier
  translate: PlaylistTranslator
}

export type PlaylistQueryDependencies = {
  invoke: PlaylistIpcInvoker
  get: PlaylistGetter
  playlistsRef: MutableRef<EnrichedPlaylist[]>
  playlistsLoadedRef: MutableRef<boolean>
  playlistsRequestRef: MutableRef<Promise<EnrichedPlaylist[]> | null>
  setPlaylists: Dispatch<SetStateAction<EnrichedPlaylist[]>>
  setPlaylistsLoading: Dispatch<SetStateAction<boolean>>
  setPlaylistsLoaded: Dispatch<SetStateAction<boolean>>
  setPlaylistsLastLoadedAt: Dispatch<SetStateAction<number | null>>
  allSongsRequestRef: MutableRef<Promise<AudioFilesPage> | null>
  allSongsLoadedPagesRef: MutableRef<Set<number>>
  setAllSongs: Dispatch<SetStateAction<AudioFileInfo[]>>
  setAllSongsLoading: Dispatch<SetStateAction<boolean>>
  setAllSongsHasMore: Dispatch<SetStateAction<boolean>>
  setAllSongsPage: Dispatch<SetStateAction<number>>
  setRandomPlaylist: Dispatch<SetStateAction<EnrichedPlaylist | null>>
  setNews: Dispatch<SetStateAction<AudioFileInfo[]>>
  getNewsMessage: string
  latestInvoke: <T>(channel: string, ...args: unknown[]) => Promise<{ isLatest: boolean; result: T }>
}

export type PlaylistIpcInvoker = <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>

export type PlaylistGetter = <T>(
  channel: string,
  setState?: Dispatch<SetStateAction<T>> | null,
  value?: unknown,
  message?: string | null
) => Promise<T>

export type PlaylistTranslator = (
  key: string,
  params?: Record<string, unknown>,
  fallback?: string
) => string

export type PlaylistToastType = 'success' | 'error'

export type PlaylistToastNotifier = (type: PlaylistToastType, message: string, toastId?: string) => void

export type PlaylistContextValue = {
  allSongs: AudioFileInfo[]
  allSongsLoading: boolean
  allSongsHasMore: boolean
  allSongsPage: number
  playlists: EnrichedPlaylist[]
  deletingPlaylistPaths: string[]
  playlistsLoading: boolean
  playlistsLoaded: boolean
  playlistsLastLoadedAt: number | null
  getSavedLists: (options?: PlaylistLoadOptions) => Promise<EnrichedPlaylist[] | null>
  addPlaylisthistory: (path?: string | null) => Promise<PlaylistHistoryResponse>
  deletePlaylist: (filePath?: string | null) => PlaylistDeleteResponse
  isPlaylistDeleting: (filePath: string) => boolean
  getUniqueList: (
    setState: (value: RendererPlaylistListResult) => void,
    filePath?: string | null
  ) => Promise<RendererPlaylistListResult | null>
  getAllSongs: (
    page?: number,
    options?: PlaylistPaginationOptions
  ) => Promise<AudioFilesPage | null>
  openM3U: (options?: PlaylistOpenOptions) => Promise<LoadListResult | { success: false; error: string } | null | undefined>
  randomPlaylist: EnrichedPlaylist | null
  updatePlaylistMetadata: (
    path: string,
    payload: Omit<UpdatePlaylistMetadataRequest, 'path'>
  ) => Promise<UpdatePlaylistMetadataResult>
  news: AudioFileInfo[]
  getNews: () => Promise<AudioFileInfo[]>
  currentCover: string
  getRandomList: () => Promise<EnrichedPlaylist | null>
  removeSongFromList: (playlistPath: string, index: number) => Promise<void>
  addSongToList: (playlistPath: string, newTrack: unknown) => Promise<void>
  appendTracksToPlaylist: (
    playlistPath: string,
    tracks?: PlaylistTrackInput[]
  ) => Promise<AppendTracksToPlaylistResult>
  deleteDirectoryList: (path: string) => Promise<void>
  exportPlaylistTracks: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistExportOptions
  ) => Promise<ExportPlaylistResult | { success: false; error: string }>
  exportPlaylistTracksToDirectory: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistExportDirectoryOptions
  ) => Promise<ExportPlaylistResult | { success: false; error: string }>
  resolvePlaylistSaveDirectory: (sourcePath?: string) => Promise<string | null>
  listPlaylistSaveDirectory: (directoryPath: string) => Promise<unknown>
  savePlaylistFromTracks: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistSaveOptions
  ) => Promise<ExportPlaylistResult | { success: false; error: string }>
}

export type PlaylistDeleteCompletionHandler = (result: PlaylistDeleteCompletedPayload) => void

export type PlaylistOperationResponse = {
  success: boolean
  error?: string
  message?: string
  [key: string]: unknown
}

export type PlaylistSavePayload = SaveM3uRequest
