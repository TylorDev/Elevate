// @ts-nocheck
import {
  buildCollectionSummaryFromFileInfos,
  mapSongRecordToFileInfo,
  USER_PREFERENCE_TRACK_SELECT
} from '../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import {
  buildInsightRankingsFromTracks,
  normalizeRankingPageRequest
} from './shared.ts'

export async function getLikesOverview(request = {}) {
  const favorites = await prisma.userPreferences.findMany({
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
  const tracks = favorites.map((preference) => mapSongRecordToFileInfo(preference.Songs)).filter(Boolean)
  const cover = await generateCollectionCoverFromTracks(tracks)
  const summary = buildCollectionSummaryFromFileInfos(tracks, { cover })

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

export async function getLikesTracksPage(request = {}) {
  const { page, pageSize } = normalizeRankingPageRequest(request)
  const offset = (page - 1) * pageSize
  const total = await prisma.userPreferences.count({
    where: { is_favorite: true }
  })
  const favorites = await prisma.userPreferences.findMany({
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
  const items = favorites.map((preference) => mapSongRecordToFileInfo(preference.Songs)).filter(Boolean)

  return {
    items,
    page,
    pageSize,
    total,
    hasMore: offset + items.length < total
  }
}
