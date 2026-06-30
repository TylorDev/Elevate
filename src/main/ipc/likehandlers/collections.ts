import {
  buildCollectionSummaryFromFileInfos,
  mapSongRecordToFileInfo,
  USER_PREFERENCE_TRACK_SELECT
} from '../../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import {
  buildInsightRankingsFromTracks,
  normalizeRankingPageRequest
} from './shared.ts'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  CollectionSummary,
  LikeCollectionOverviewResult,
  LikesTracksPageResult,
  PageRequest,
  SongRecordWithPreferences
} from '../../Types/likeHandlers.ts'

const db = prisma as unknown as PrismaClient
const mapSongToFileInfo = mapSongRecordToFileInfo as (
  song: SongRecordWithPreferences | null | undefined
) => AudioFileInfo | null
const buildCollectionSummary = buildCollectionSummaryFromFileInfos as (
  tracks: AudioFileInfo[],
  extras?: Partial<CollectionSummary>
) => CollectionSummary
const generateCollectionCover = generateCollectionCoverFromTracks as (
  tracks: AudioFileInfo[]
) => Promise<Buffer | null>

export async function getLikesOverview(
  request: PageRequest = {}
): Promise<LikeCollectionOverviewResult> {
  const favorites = await db.userPreferences.findMany({
    where: { is_favorite: true },
    include: {
      Songs: {
        include: {
          UserPreferences: {
            select: USER_PREFERENCE_TRACK_SELECT
          }
        }
      }
    }
  })
  const tracks = favorites
    .map((preference) => mapSongToFileInfo(preference.Songs as SongRecordWithPreferences))
    .filter((track): track is AudioFileInfo => Boolean(track))
  const cover = await generateCollectionCover(tracks)
  const summary = buildCollectionSummary(tracks, { cover })

  return {
    success: true,
    type: 'likes',
    meta: {
      title: 'Favourites'
    },
    summary,
    rankings: buildInsightRankingsFromTracks(tracks, request)
  }
}

export async function getLikesTracksPage(
  request: PageRequest = {}
): Promise<LikesTracksPageResult> {
  const { page, pageSize } = normalizeRankingPageRequest(request)
  const offset = (page - 1) * pageSize
  const total = await db.userPreferences.count({
    where: { is_favorite: true }
  })
  const favorites = await db.userPreferences.findMany({
    where: { is_favorite: true },
    skip: offset,
    take: pageSize,
    include: {
      Songs: {
        include: {
          UserPreferences: {
            select: USER_PREFERENCE_TRACK_SELECT
          }
        }
      }
    }
  })
  const items = favorites
    .map((preference) => mapSongToFileInfo(preference.Songs as SongRecordWithPreferences))
    .filter((track): track is AudioFileInfo => Boolean(track))

  return {
    items,
    page,
    pageSize,
    total,
    hasMore: offset + items.length < total
  }
}
