import type { IpcMainInvokeEvent } from 'electron'
import type { Prisma, Songs, UserPreferences } from '../generated/prisma/client.ts'
import type {
  AudioCoverPayload,
  AudioFileInfo,
  CollectionSummary,
  ErrorResponse,
  InsightRankingId,
  InsightRankings,
  MaybePromise,
  MutationResponse,
  PageRequest,
  PageResult,
  RankingMetricKey,
  RankingPage,
  SuccessResponse
} from './filehandlers.ts'

export type {
  AudioCoverPayload,
  AudioFileInfo,
  CollectionSummary,
  ErrorResponse,
  InsightRankingId,
  InsightRankings,
  MaybePromise,
  MutationResponse,
  PageRequest,
  PageResult,
  RankingMetricKey,
  RankingPage,
  SuccessResponse
} from './filehandlers.ts'

export type { NormalizedPageRequest } from './filehandlers.ts'

export type LikeSongPayload = {
  filePath: string
  fileName: string
  [key: string]: unknown
}

export type PreferenceField = 'is_favorite' | 'listen_later'

export type PreferenceCriteria = Pick<Prisma.UserPreferencesWhereInput, PreferenceField>

export type SongPreferenceMutationResult =
  | SuccessResponse<{
      songId: number
    }>
  | ErrorResponse

export type SongLikedResult =
  | SuccessResponse<{
      liked: boolean
    }>
  | ErrorResponse

export type PreferenceCollectionResult =
  | {
      fileInfos: AudioFileInfo[]
      cover: AudioCoverPayload | Buffer | null
      totalDuration: number
    }
  | ErrorResponse

export type UpdateSongPreferenceAction = (
  songId: number,
  updateData?: unknown
) => MaybePromise<void>

export type PlaybackEventType =
  | 'short-view-award'
  | 'long-view-award'
  | 'repeat-award'
  | 'skip-award'
  | 'playback-finalize'

export type PlaybackRecordPayload = {
  filePath?: string | null
  fileName?: string | null
  eventType?: PlaybackEventType | string | null
  duration?: number | string | null
  activeListeningSeconds?: number | string | null
  countAsRepeat?: boolean | null
}

export type PlaybackStats = Pick<
  UserPreferences,
  | 'play_count'
  | 'skip_count'
  | 'short_view_count'
  | 'long_view_count'
  | 'long_play_seconds'
  | 'active_listening_seconds'
  | 'consecutive_repeat_count'
  | 'bpm'
  | 'is_favorite'
> & {
  lastPlayedAt?: string | null
}

export type PlaybackRecordResult =
  | SuccessResponse<{
      songId: number
      eventType: PlaybackEventType
      isConsecutiveRepeat: boolean
      stats: Partial<PlaybackStats>
    }>
  | ErrorResponse

export type PlaybackIncrementUpdate = Partial<
  Record<
    | 'play_count'
    | 'skip_count'
    | 'short_view_count'
    | 'long_view_count'
    | 'long_play_seconds'
    | 'active_listening_seconds'
    | 'consecutive_repeat_count',
    {
      increment: number
    }
  >
>

export type PlaybackPreferenceCreate = {
  song_id: number
} & Partial<
  Pick<
    UserPreferences,
    | 'play_count'
    | 'skip_count'
    | 'short_view_count'
    | 'long_view_count'
    | 'long_play_seconds'
    | 'active_listening_seconds'
    | 'consecutive_repeat_count'
  >
>

export type SongRecordWithPreferences = Songs & {
  UserPreferences?: UserPreferences[] | UserPreferences | null
}

export type HistoryPageRequest = number | PageRequest | null | undefined

export type HistoryAudioFileInfo = AudioFileInfo & {
  lastPlayedAt?: string | null
}

export type HistoryPageResult =
  | (PageResult<HistoryAudioFileInfo> & {
      fileInfos: HistoryAudioFileInfo[]
      maxPages: number
    })
  | ErrorResponse

export type SongHistoryTimelineRequest = {
  filePath?: string | null
}

export type SongHistoryDailyRecord = {
  date: string
  count: number
}

export type SongHistoryTimelineResult =
  | SuccessResponse<{
      song: Partial<AudioFileInfo> & {
        song_id: number
        filePath: string
      }
      libraryAddedAt: string | null
      totalRecords: number
      firstPlayedAt: string | null
      lastPlayedAt: string | null
      peakDay: SongHistoryDailyRecord | null
      dailyRecords: SongHistoryDailyRecord[]
      events: string[]
    }>
  | ErrorResponse

export type SearchSongsFilters = {
  name?: boolean | null
  artist?: boolean | null
}

export type NormalizedSearchSongsFilters = {
  name: boolean
  artist: boolean
}

export type SearchSongsPageRequest = PageRequest & {
  query?: string | null
  filters?: SearchSongsFilters | null
}

export type SearchQueryInfo = {
  raw: string
  normalized: string
  compact: string
}

export type SearchFieldMatchScore = number | null

export type SearchSongMatch = {
  matches: boolean
  priority: number
}

export type ParsedArtistTitle = {
  artist: string
  title: string
}

export type SearchSongItem = {
  song_id: number
  filePath: string
  fileName: string
  artist: string
  album: string
  genre: string
  year: number
  duration: number
  size: number
  trackNumber: number
  metadataLoaded: boolean
  skip_count: number
  short_view_count: number
  long_view_count: number
  long_play_seconds: number
  active_listening_seconds: number
  consecutive_repeat_count: number
  liked: boolean
  lastPlayedAt: string | null
}

export type SearchSongsPage = PageResult<SearchSongItem>

export type LikeInsightMetricKeys = Record<InsightRankingId, RankingMetricKey>

export type LikeCollectionOverviewResult =
  | SuccessResponse<{
      type: 'likes'
      meta: {
        title: string
      }
      summary: CollectionSummary
      rankings: InsightRankings
    }>
  | ErrorResponse

export type LikesTracksPageResult = PageResult<AudioFileInfo>

export type StatisticsOverviewResult =
  | SuccessResponse<{
      type: 'library'
      meta: {
        title: string
      }
      summary: CollectionSummary
      rankings: InsightRankings
    }>
  | ErrorResponse

export type StatisticsRankingPageRequest = PageRequest & {
  tabId?: InsightRankingId | string | null
}

export type StatisticsRankingPageResult =
  | SuccessResponse<{
      ranking: RankingPage<AudioFileInfo>
    }>
  | ErrorResponse

export type LikeIpcContract = {
  'like-song': {
    args: [common: LikeSongPayload]
    result: SongPreferenceMutationResult
  }
  'is-song-liked': {
    args: [filepath?: string | null, filename?: string | null]
    result: SongLikedResult
  }
  'playback:record': {
    args: [payload?: PlaybackRecordPayload]
    result: PlaybackRecordResult
  }
  'unlike-song': {
    args: [common: LikeSongPayload]
    result: MutationResponse | SongPreferenceMutationResult
  }
  'get-likes': {
    args: []
    result: PreferenceCollectionResult
  }
  'get-likes-number': {
    args: []
    result: number
  }
  'listen-later-song': {
    args: [filepath?: string | null, filename?: string | null]
    result: SongPreferenceMutationResult
  }
  'get-listen-later': {
    args: []
    result: PreferenceCollectionResult
  }
  'get-history': {
    args: [request?: HistoryPageRequest]
    result: HistoryPageResult
  }
  'history:get-song-timeline': {
    args: [request?: SongHistoryTimelineRequest]
    result: SongHistoryTimelineResult
  }
  'get-recents': {
    args: []
    result: AudioFileInfo[] | ErrorResponse
  }
  'get-most-played': {
    args: []
    result: AudioFileInfo[] | ErrorResponse
  }
  'statistics:get-overview': {
    args: [request?: PageRequest]
    result: StatisticsOverviewResult
  }
  'statistics:get-ranking-page': {
    args: [request?: StatisticsRankingPageRequest]
    result: StatisticsRankingPageResult
  }
  'remove-listen-later': {
    args: [filepath?: string | null, filename?: string | null]
    result: MutationResponse | SongPreferenceMutationResult
  }
  'search-songs-page': {
    args: [request?: SearchSongsPageRequest]
    result: SearchSongsPage
  }
}

export type LikeChannel = keyof LikeIpcContract

export type LikeArgs<C extends LikeChannel> = LikeIpcContract[C]['args']

export type LikeResult<C extends LikeChannel> = LikeIpcContract[C]['result']

export type LikeInvokeHandler<C extends LikeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: LikeArgs<C>
) => MaybePromise<LikeResult<C>>
