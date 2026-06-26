import type { IpcMainInvokeEvent } from 'electron'
import type { Directory, Playlist, Songs } from '../generated/prisma/client.ts'

export type Nullable<T> = T | null
export type MaybePromise<T> = T | Promise<T>

export type ErrorLike = {
  message?: string
}

export type SuccessResponse<T extends object = object> = {
  success: true
  error?: never
  message?: string
} & T

export type ErrorResponse = {
  success: false
  error?: string
  message?: string
}

export type MutationResponse = SuccessResponse<{ message?: string }> | ErrorResponse

export type PageRequest = {
  page?: number | string | null
  pageSize?: number | string | null
}

export type NormalizedPageRequest = {
  page: number
  pageSize: number
}

export type PageResult<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export type SearchPageRequest = PageRequest & {
  query?: string | null
}

export type AudioPageRequest = number | PageRequest | null | undefined

export type AudioCoverVariant = 'thumb' | 'full'

export type AudioCoverPayload = {
  data: Buffer
  mimeType: string
}

export type ExtractedAudioCover = {
  buffer: Buffer
  format: string
}

export type AudioFileInfo = {
  song_id: number
  filePath: string
  fileName: string
  title: string | null
  artist: string | null
  album: string | null
  genre: string | null
  year: number | null
  duration: number
  size: number
  trackNumber: number | null
  coverHash: string | null
  bpm: number
  skip_count: number
  short_view_count: number
  long_view_count: number
  long_play_seconds: number
  active_listening_seconds: number
  consecutive_repeat_count: number
  liked: boolean
  lastPlayedAt?: string | null
  picture?: unknown
  [key: string]: unknown
}

export type AudioFilesPage = PageResult<AudioFileInfo>

export type AudioPathsCacheEntry = {
  files: string[]
  expiresAt: number
}

export type AudioCoverCacheEntry = {
  cover: AudioCoverPayload | null
  expiresAt: number
}

export type DirectoryKind = 'root' | 'normal'

export type DirectoryWithChildrenCount = Directory & {
  childrenCount?: number
  _count?: {
    children?: number | null
  }
}

export type DirectoryBranchRecord = Pick<Directory, 'id' | 'path' | 'parentId'>

export type DirectoryRecursiveStats = {
  recursiveTotalTracks: number
  recursiveTotalDuration: number
}

export type EnrichedDirectory = DirectoryWithChildrenCount &
  DirectoryRecursiveStats & {
    childrenCount: number
    directoryKind: DirectoryKind
  }

export type DirectoryDeleteOptions = {
  invalidateDirectoryCache: (dirPath?: string | null) => void
}

export type DeleteDirectoryBranchRequest =
  | string
  | {
      path?: string | null
    }
  | null
  | undefined

export type DeleteDirectoryBranchResponse =
  | SuccessResponse<{
      message: string
      deletedDirectories: number
      deletedPaths: string[]
    }>
  | ErrorResponse

export type DirectorySearchItem = {
  type: 'directory'
  id: number
  title: string
  subtitle: string
  meta: string
  actionPayload: {
    path: string
  }
  path: string
  totalTracks: number
  totalDuration: number
  recursiveTotalTracks: number
  recursiveTotalDuration: number
  visibleTracks: number
  visibleDuration: number
  directoryKind: DirectoryKind
}

export type DirectorySearchPage = PageResult<DirectorySearchItem>

export type CollectionType = 'likes' | 'playlist' | 'directory'

export type CollectionRequest = PageRequest & {
  type?: CollectionType | string | null
  sourcePath?: string | null
  [key: string]: unknown
}

export type CollectionSummary = {
  totalDuration: number
  totalShortViews: number
  totalLongViews: number
  totalAccumulatedDuration: number
  totalRepeats: number
  totalSkips: number
  trackCount: number
  sourcePath?: string
  cover?: Buffer | null
  [key: string]: unknown
}

export type RankingMetricKey =
  | 'duration'
  | 'short_view_count'
  | 'long_view_count'
  | 'active_listening_seconds'
  | 'consecutive_repeat_count'
  | 'skip_count'

export type InsightRankingId =
  | 'duration'
  | 'shortViews'
  | 'longViews'
  | 'accumulatedDuration'
  | 'repeats'
  | 'skips'

export type RankingPage<T = AudioFileInfo> = PageResult<T> & {
  totalValue: number
}

export type InsightRankings = Partial<Record<InsightRankingId, RankingPage<AudioFileInfo>>>

export type DirectoryCollectionOverviewSuccess = SuccessResponse<{
  type: 'directory'
  meta: {
    title: string
    sourcePath: string
    createdAt: Date | null
    lastScannedAt: Date | null
    editable: false
    directoryKind: DirectoryKind
    recursiveTotalTracks: number
    recursiveTotalDuration: number
    directoryData: EnrichedDirectory
  }
  summary: CollectionSummary
  rankings: InsightRankings
}>

export type CollectionOverviewResult =
  | DirectoryCollectionOverviewSuccess
  | ErrorResponse
  | Record<string, unknown>

export type CollectionTracksPageResult = PageResult<AudioFileInfo> | ErrorResponse | Record<string, unknown>

export type FeedScope = 'mixed' | 'playlists' | 'directories'

export type FeedRankingTabId =
  | 'recent'
  | 'shortViews'
  | 'longViews'
  | 'duration'
  | 'accumulatedDuration'
  | 'repeats'
  | 'skips'

export type FeedRankingDirection = 'date' | 'number'

export type FeedRankingTab = {
  metricKey: keyof FeedCollectionEntity
  direction: FeedRankingDirection
}

export type FeedRankingsRequest = PageRequest & {
  scope?: FeedScope | string | null
  tabId?: FeedRankingTabId | string | null
  forceRefresh?: boolean | null
}

export type NormalizedFeedRankingsRequest = {
  scope: FeedScope
  tabId: FeedRankingTabId | ''
  page: number
  pageSize: number
  forceRefresh: boolean
}

export type FeedCollectionType = 'playlist' | 'directory'

export type FeedCollectionEntity = {
  id: string
  type: FeedCollectionType
  name: string
  path: string
  coverKey: string
  coverSignature: string
  totalShortViews: number
  totalLongViews: number
  totalDuration: number
  totalAccumulatedDuration: number
  totalRepeats: number
  totalSkips: number
  recentActivityAt: string | null
  trackCount: number
}

export type FeedRankingPage = RankingPage<FeedCollectionEntity>

export type FeedRankings = Partial<Record<FeedRankingTabId, FeedRankingPage>>

export type FeedSnapshot = {
  version: number
  status: 'ready'
  scope: FeedScope
  generatedAt: string
  sourceSignature: string
  entities: FeedCollectionEntity[]
}

export type FeedCollectionRankingsResult = SuccessResponse<{
  scope: FeedScope
  total: number
  cached: boolean
  stale: boolean
  cacheMiss: boolean
  refreshing: boolean
  generatedAt: string | null
  rankings: FeedRankings
}>

export type FeedRefreshResult = SuccessResponse<{
  scope: FeedScope
  started: boolean
  alreadyRunning: boolean
}>

export type FeedCoverRequest = {
  coverKey?: string | null
  coverSignature?: string | null
}

export type DecodedFeedCoverKey = {
  type: FeedCollectionType
  sourcePath: string
}

export type FeedSourceSignaturePlaylist = Pick<
  Playlist,
  | 'id'
  | 'path'
  | 'duracion'
  | 'numElementos'
  | 'totalplays'
  | 'customCoverMode'
  | 'customCoverHash'
  | 'customCoverValue'
  | 'customCoverSelection'
  | 'customCoverUpdatedAt'
>

export type SongDurationRecord = Pick<Songs, 'duration'>

export type ExplorerActionResult = SuccessResponse | ErrorResponse

export type AddDirectoryResult = unknown

export type FilehandlerIpcContract = {
  'add-directory': {
    args: [providedPath?: string | null]
    result: AddDirectoryResult | null
  }
  'get-new-audio-files': {
    args: []
    result: AudioFileInfo[]
  }
  'get-all-audio-files': {
    args: [currentPage?: AudioPageRequest]
    result: AudioFileInfo[]
  }
  'get-all-audio-files-page': {
    args: [request?: AudioPageRequest]
    result: AudioFilesPage
  }
  'get-audio-cover-thumbnail': {
    args: [filePath?: string | null]
    result: AudioCoverPayload | null
  }
  'get-audio-cover-full': {
    args: [filePath?: string | null]
    result: AudioCoverPayload | null
  }
  'get-all-audio-files-number': {
    args: []
    result: number
  }
  'get-audio-in-directory': {
    args: [directoryPath: string]
    result: AudioFileInfo[]
  }
  'collection:get-overview': {
    args: [request?: CollectionRequest]
    result: CollectionOverviewResult
  }
  'collection:get-tracks-page': {
    args: [request?: CollectionRequest]
    result: CollectionTracksPageResult
  }
  'collection:get-playlist-edit-payload': {
    args: [playlistPath?: string | null]
    result: unknown
  }
  'feed:get-collection-rankings': {
    args: [request?: FeedRankingsRequest]
    result: FeedCollectionRankingsResult | ErrorResponse
  }
  'feed:refresh-collection-rankings': {
    args: [request?: FeedRankingsRequest]
    result: FeedRefreshResult | ErrorResponse
  }
  'feed:get-collection-cover': {
    args: [request?: FeedCoverRequest]
    result: AudioCoverPayload | null
  }
  'delete-directory': {
    args: [dirPath: string]
    result: MutationResponse
  }
  'delete-directory-branch': {
    args: [request: DeleteDirectoryBranchRequest]
    result: DeleteDirectoryBranchResponse
  }
  'get-all-directories': {
    args: []
    result: EnrichedDirectory[]
  }
  'get-directories-number': {
    args: []
    result: number
  }
  'get-random-directory': {
    args: []
    result: EnrichedDirectory | null
  }
  'search-directories-page': {
    args: [request?: SearchPageRequest]
    result: DirectorySearchPage
  }
  'reveal-path-in-explorer': {
    args: [targetPath?: string | null]
    result: ExplorerActionResult
  }
  'open-directory-in-explorer': {
    args: [targetPath?: string | null]
    result: ExplorerActionResult
  }
}

export type FilehandlerChannel = keyof FilehandlerIpcContract

export type FilehandlerArgs<C extends FilehandlerChannel> = FilehandlerIpcContract[C]['args']

export type FilehandlerResult<C extends FilehandlerChannel> = FilehandlerIpcContract[C]['result']

export type FilehandlerInvokeHandler<C extends FilehandlerChannel> = (
  event: IpcMainInvokeEvent,
  ...args: FilehandlerArgs<C>
) => MaybePromise<FilehandlerResult<C>>
