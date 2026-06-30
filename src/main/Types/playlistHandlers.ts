import type { WebContents } from 'electron'
import type { Playlist } from '../generated/prisma/client.ts'
import type {
  AudioCoverPayload,
  AudioFileInfo,
  CollectionSummary,
  InsightRankings
} from './filehandlers.ts'
import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'
import type {
  CoverVariant,
  ErrorResponse,
  MaybePromise,
  PageResult,
  SearchPageRequest,
  SuccessResponse
} from './shared.ts'

export type PlaylistCoverMode =
  | 'auto'
  | 'auto-generated'
  | 'local-image'
  | 'remote-image'
  | 'suggested-collage'
  | ''
  | null

export type PlaylistCoverConfig = {
  customCoverMode: string | null
  customCoverHash: string | null
  customCoverValue: string | null
  customCoverSelection: unknown | null
}

export type PlaylistCoverSelectionInput =
  | string
  | {
      suggestedId?: string | null
      filePath?: string | null
      coverHash?: string | null
    }

export type SuggestedCoverItem = {
  suggestedId: string
  filePath: string | null
  title: string | null
  artist: string | null
  coverHash: string | null
  short_view_count: number
  picture: Array<{
    data: Buffer
    type: string
    format: string
  }>
}

export type SelectedCoverItem = {
  suggestedId?: string | null
  filePath?: string | null
  coverHash?: string | null
  picture?: Array<{
    data?: Buffer | Uint8Array | string | null
  }> | null
  localPath?: string | null
  resolvedUrl?: string | null
}

export type StoredPlaylistCover = {
  coverHash: string
  thumbPath: string
  fullPath: string
}

export type PlaylistCoverUpdateExtras = {
  customCoverValue?: string | null
  customCoverSelection?: string | null
}

export type MaterializedPlaylistCover = {
  playlist: Playlist | null
  cover: AudioCoverPayload | null
}

export type PlaylistSummary = {
  id: number
  path: string
  nombre: string
  duracion: number
  numElementos: number
  createdAt: Date
  totalplays: number
  customCoverHash: string | null
  cover: AudioCoverPayload | null
  effectiveCover: AudioCoverPayload | null
  coverConfig: PlaylistCoverConfig | null
}

export type EnrichedPlaylist = Playlist & {
  cover?: AudioCoverPayload | null
  effectiveCover?: AudioCoverPayload | null
  coverConfig?: PlaylistCoverConfig | null
}

export type PlaylistOverviewResult = SuccessResponse<{
  type: 'playlist'
  meta: {
    title: string
    sourcePath: string
    createdAt: Date | null
    totalplays: number
    editable: true
  }
  summary: CollectionSummary<AudioCoverPayload>
  rankings: InsightRankings
  playlistData: Playlist | null
  cover: null
  suggestedCovers: SuggestedCoverItem[]
  effectiveCover: AudioCoverPayload | null
  coverConfig: PlaylistCoverConfig | null
}>

export type PlaylistEditPayload =
  | SuccessResponse<{
      playlistData: Playlist
      cover: null
      suggestedCovers: SuggestedCoverItem[]
      effectiveCover: AudioCoverPayload | null
      coverConfig: PlaylistCoverConfig | null
    }>
  | ErrorResponse

export type PlaylistListPayload = {
  processedData: AudioFileInfo[]
  playlistData: Playlist | null
  cover: null
  suggestedCovers: SuggestedCoverItem[]
  effectiveCover: AudioCoverPayload | null
  coverConfig: PlaylistCoverConfig | null
}

export type PlaylistNameRecord = Pick<Playlist, 'nombre' | 'path'>
export type PlaylistIdentityRecord = Pick<Playlist, 'id' | 'nombre' | 'path'>

export type PlaylistDeleteQueuedResponse =
  | SuccessResponse<{
      queued: true
      jobId: string
      path: string
    }>
  | ErrorResponse

export type PlaylistDeleteCompletedPayload = {
  jobId: string
  path: string
  success: boolean
  error: string | null
}

export type PlaylistSender = Pick<WebContents, 'send' | 'isDestroyed'>

export type PlaylistDeleteResult =
  | SuccessResponse<{
      path: string
      notFound?: boolean
    }>
  | ErrorResponse

export type PlaylistEnricher<TInput extends Playlist = Playlist, TOutput = EnrichedPlaylist> = (
  playlist: TInput,
  options?: {
    coverError?: unknown
  }
) => MaybePromise<TOutput>

export type PlaylistListRequest = {
  take?: number | null
  skip?: number | null
}

export type PlaylistMinimal = Pick<
  Playlist,
  'id' | 'path' | 'nombre' | 'numElementos' | 'duracion' | 'customCoverMode' | 'customCoverHash'
> & {
  cover: null
  effectiveCover: null
  coverConfig: PlaylistCoverConfig
}

export type PlaylistSearchItem = {
  type: 'playlist'
  id: number
  title: string
  subtitle: string
  meta: string
  actionPayload: {
    path: string
  }
  cover: AudioCoverPayload | null | undefined
  effectiveCover: AudioCoverPayload | null | undefined
  coverConfig: PlaylistCoverConfig | null | undefined
  path: string
  nombre: string
  duracion: number
  numElementos: number
  totalplays: number
}

export type PlaylistSearchPage = PageResult<PlaylistSearchItem>

export type UpsertPlaylistMetadataInput = Partial<
  Pick<
    Playlist,
    | 'path'
    | 'nombre'
    | 'duracion'
    | 'numElementos'
    | 'totalplays'
    | 'customCoverMode'
    | 'customCoverHash'
    | 'customCoverValue'
    | 'customCoverSelection'
    | 'customCoverUpdatedAt'
  >
>

export type UpsertPlaylistMetadataResult =
  | SuccessResponse<{
      playlist: Playlist
    }>
  | ErrorResponse

export type PersistPlaylistRecordOptions = {
  allowExistingPath?: boolean
}

export type PersistPlaylistRecordResult =
  | SuccessResponse<{
      path: string
      playlistName: string
      playlist: Playlist
    }>
  | ErrorResponse

export type SavePlaylistResult =
  | SuccessResponse<{
      playlistName: string
    }>
  | ErrorResponse

export type SaveM3uFileResult =
  | SuccessResponse<{
      path: string
    }>
  | ErrorResponse

export type PlaylistDetails = {
  totalDuration: number
  totalTracks: number
  contador: Promise<number>
}

export type ResolveUniquePlaylistPathRequest = {
  targetDirectory?: string | null
  requestedName?: string | null
  targetPath?: string | null
}

export type SavePlaylistToTargetRequest = {
  filePaths?: unknown
  targetPath?: string | null
  targetDirectory?: string | null
  nombre?: string
}

export type SaveM3uRequest = SavePlaylistToTargetRequest & {
  persist?: boolean
}

export type ExportPlaylistResult =
  | SuccessResponse<{
      path: string
      playlistName: string
    }>
  | ErrorResponse

export type DuplicateImportedPlaylist = {
  type: 'same-path' | 'same-name-and-tracks' | 'same-name'
  playlist: Playlist | PlaylistIdentityRecord
} | null

export type RemoveTrackFromPlaylistRequest = {
  filePath: string
  index: number
}

export type AddNewSongToPlaylistRequest = {
  filePath: string
  song: string
}

export type AppendTracksToPlaylistRequest = {
  playlistPath?: string | null
  filePaths?: unknown
}

export type AppendTracksToPlaylistResult =
  | SuccessResponse<{
      addedCount: number
      skippedCount: number
      playlist: Playlist | null
    }>
  | ErrorResponse

export type UpdatePlaylistMetadataRequest = {
  path?: string | null
  nombre?: string | null
  coverMode?: PlaylistCoverMode
  coverValue?: string | null
  coverSelection?: PlaylistCoverSelectionInput[] | null
}

export type UpdatePlaylistMetadataResult =
  | SuccessResponse<{
      playlist: PlaylistSummary | null
      coverConfig: PlaylistCoverConfig | null
      effectiveCover: AudioCoverPayload | null
    }>
  | ErrorResponse

export type EnsurePlaylistCoverRequest =
  | string
  | {
      playlistPath?: string | null
      variant?: CoverVariant
    }
  | null
  | undefined

export type EnsurePlaylistCoverResult =
  | SuccessResponse<{
      cover: AudioCoverPayload
      coverHash: string | null
      coverConfig: PlaylistCoverConfig | null
    }>
  | ErrorResponse

export type LoadListResult =
  | PersistPlaylistRecordResult
  | ErrorResponse
  | (ErrorResponse & {
      canceled?: boolean
    })

export type PlaylistIpcContract = {
  'load-list': {
    args: [explicitFilePath?: string | null]
    result: LoadListResult
  }
  'get-list': {
    args: [filepath?: string | null]
    result: PlaylistListPayload | ErrorResponse
  }
  'playlist:ensure-cover': {
    args: [request?: EnsurePlaylistCoverRequest]
    result: EnsurePlaylistCoverResult
  }
  'playlist:get-cover': {
    args: [request?: EnsurePlaylistCoverRequest]
    result: EnsurePlaylistCoverResult
  }
  'get-playlists': {
    args: []
    result: EnrichedPlaylist[]
  }
  'get-playlists-minimal': {
    args: []
    result: PlaylistMinimal[]
  }
  'search-playlists-page': {
    args: [request?: SearchPageRequest]
    result: PlaylistSearchPage
  }
  'get-playlists-number': {
    args: []
    result: number
  }
  'get-random-playlist': {
    args: []
    result: EnrichedPlaylist | null
  }
  'delete-playlist': {
    args: [filePath?: string | null]
    result: PlaylistDeleteQueuedResponse
  }
  'update-playlist-metadata': {
    args: [request?: UpdatePlaylistMetadataRequest]
    result: UpdatePlaylistMetadataResult
  }
  'load-list-to-history': {
    args: [filePath?: string | null]
    result: void
  }
  'update-list': {
    args: [request: RemoveTrackFromPlaylistRequest]
    result: UpsertPlaylistMetadataResult
  }
  'add-new-song': {
    args: [request: AddNewSongToPlaylistRequest]
    result: UpsertPlaylistMetadataResult & { songName?: string }
  }
  'append-tracks-to-playlist': {
    args: [request?: AppendTracksToPlaylistRequest]
    result: AppendTracksToPlaylistResult
  }
  'save-m3u': {
    args: [request?: SaveM3uRequest]
    result: PersistPlaylistRecordResult | ExportPlaylistResult
  }
}

export type PlaylistChannel = IpcChannel<PlaylistIpcContract>
export type PlaylistArgs<C extends PlaylistChannel> = IpcArgs<PlaylistIpcContract, C>
export type PlaylistInvokeHandler<C extends PlaylistChannel> = IpcInvokeHandler<
  PlaylistArgs<C>,
  PlaylistIpcContract[C]['result']
>
