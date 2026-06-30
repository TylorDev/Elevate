import { getLastPlayedAtBySongId } from '../../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import {
  normalizeSearchQuery,
  STAT_SELECT
} from './shared.ts'
import type { PrismaClient, Songs, UserPreferences } from '../../generated/prisma/client.ts'
import type {
  NormalizedSearchSongsFilters,
  ParsedArtistTitle,
  SearchFieldMatchScore,
  SearchQueryInfo,
  SearchSongItem,
  SearchSongMatch,
  SearchSongsPage,
  SearchSongsPageRequest
} from '../../Types/likeHandlers.ts'

type SearchableSong = Songs & {
  UserPreferences?: Partial<UserPreferences>[] | null
}

const db = prisma as unknown as PrismaClient
const getLastPlayedAt = getLastPlayedAtBySongId as (
  songIds: Array<number | null | undefined>
) => Promise<Map<number, string>>

function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function compactSearchText(value: unknown): string {
  return normalizeSearchText(value).replace(/\s+/g, '')
}

function parseArtistTitleFromFilename(filename: unknown): ParsedArtistTitle {
  if (typeof filename !== 'string' || !filename.includes(' - ')) {
    return { artist: '', title: '' }
  }

  const [artistPart, ...titleParts] = filename.split(' - ')
  const artist = artistPart?.trim() || ''
  const title = titleParts.join(' - ').trim()

  if (!artist || !title) {
    return { artist: '', title: '' }
  }

  return { artist, title }
}

function createQueryInfo(query: string): SearchQueryInfo {
  const normalized = normalizeSearchText(query)
  const compact = compactSearchText(query)

  return {
    raw: query,
    normalized,
    compact
  }
}

function getFieldMatchScore(value: unknown, queryInfo: SearchQueryInfo): SearchFieldMatchScore {
  const normalizedValue = normalizeSearchText(value)

  if (!normalizedValue || !queryInfo.normalized) {
    return null
  }

  if (normalizedValue === queryInfo.normalized) {
    return 0
  }

  if (normalizedValue.startsWith(queryInfo.normalized)) {
    return 1
  }

  if (normalizedValue.includes(queryInfo.normalized)) {
    return 2
  }

  const compactValue = compactSearchText(value)

  if (!compactValue || !queryInfo.compact) {
    return null
  }

  if (compactValue === queryInfo.compact) {
    return 3
  }

  if (compactValue.startsWith(queryInfo.compact)) {
    return 4
  }

  if (compactValue.includes(queryInfo.compact)) {
    return 5
  }

  return null
}

function addScore(
  candidateScores: SearchFieldMatchScore[],
  value: unknown,
  queryInfo: SearchQueryInfo,
  offset = 0
): void {
  const score = getFieldMatchScore(value, queryInfo)
  candidateScores.push(score != null ? score + offset : null)
}

function getSongSearchMatch(
  song: SearchableSong,
  queryInfo: SearchQueryInfo,
  filters: NormalizedSearchSongsFilters
): SearchSongMatch {
  const parsedFromFilename = parseArtistTitleFromFilename(song.filename || '')
  const title = String(song.title || '')
  const filename = String(song.filename || '')
  const artist = String(song.artist || '')

  const candidateScores: SearchFieldMatchScore[] = []

  if (filters.name) {
    addScore(candidateScores, title, queryInfo)
    addScore(candidateScores, parsedFromFilename.title, queryInfo, 10)
    addScore(candidateScores, filename, queryInfo, 20)
    addScore(candidateScores, `${artist} ${title}`, queryInfo, 30)
    addScore(
      candidateScores,
      `${parsedFromFilename.artist} ${parsedFromFilename.title}`,
      queryInfo,
      40
    )
  }

  if (filters.artist) {
    addScore(candidateScores, artist, queryInfo, 50)
    addScore(candidateScores, parsedFromFilename.artist, queryInfo, 60)
  }

  const priority = candidateScores
    .filter((score): score is number => score != null)
    .sort((left, right) => left - right)[0]

  return {
    matches: priority != null,
    priority: priority ?? Number.POSITIVE_INFINITY
  }
}

export async function searchSongsPage(
  request: SearchSongsPageRequest = {}
): Promise<SearchSongsPage> {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 50, 1), 100)
  const filters: NormalizedSearchSongsFilters = {
    name: request?.filters?.name !== false,
    artist: request?.filters?.artist !== false
  }

  if (!query || (!filters.name && !filters.artist)) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const offset = (page - 1) * pageSize
  const queryInfo = createQueryInfo(query)

  try {
    const songs = await db.songs.findMany({
      include: {
        UserPreferences: {
          select: STAT_SELECT
        }
      }
    }) as SearchableSong[]
    const lastPlayedAtBySongId = await getLastPlayedAt(
      songs.map((song) => song.song_id)
    )

    const matchedSongs = songs
      .map((song) => ({
        song,
        match: getSongSearchMatch(song, queryInfo, filters)
      }))
      .filter(({ match }) => match.matches)
      .sort((left, right) => {
        if (left.match.priority !== right.match.priority) {
          return left.match.priority - right.match.priority
        }

        const leftName = normalizeSearchText(left.song.title || left.song.filename || '')
        const rightName = normalizeSearchText(right.song.title || right.song.filename || '')

        if (leftName !== rightName) {
          return leftName.localeCompare(rightName)
        }

        const leftArtist = normalizeSearchText(left.song.artist || '')
        const rightArtist = normalizeSearchText(right.song.artist || '')

        if (leftArtist !== rightArtist) {
          return leftArtist.localeCompare(rightArtist)
        }

        return left.song.song_id - right.song.song_id
      })
      .map(({ song }) => song)

    const total = matchedSongs.length
    const paginatedSongs = matchedSongs.slice(offset, offset + pageSize)
    const items: SearchSongItem[] = Array.isArray(paginatedSongs)
      ? paginatedSongs.map((song) => ({
          song_id: song.song_id,
          filePath: song.filepath,
          fileName: song.title || song.filename,
          artist: song.artist || '',
          album: song.album || '',
          genre: song.genre || '',
          year: song.year || 0,
          duration: Number(song.duration) || 0,
          size: song.size || 0,
          trackNumber: song.trackNumber || 0,
          metadataLoaded: Boolean(song.metadataLoaded),
          skip_count: Number(song.UserPreferences?.[0]?.skip_count) || 0,
          short_view_count: Number(song.UserPreferences?.[0]?.short_view_count) || 0,
          long_view_count: Number(song.UserPreferences?.[0]?.long_view_count) || 0,
          long_play_seconds: Number(song.UserPreferences?.[0]?.long_play_seconds) || 0,
          active_listening_seconds:
            Number(song.UserPreferences?.[0]?.active_listening_seconds) || 0,
          consecutive_repeat_count:
            Number(song.UserPreferences?.[0]?.consecutive_repeat_count) || 0,
          liked: Boolean(song.UserPreferences?.[0]?.is_favorite),
          lastPlayedAt: lastPlayedAtBySongId.get(song.song_id) || null
        }))
      : []

    return {
      items,
      page,
      pageSize,
      total: Number(total || 0),
      hasMore: offset + items.length < total
    }
  } catch (error) {
    console.error('Error searching songs page:', error)
    throw error
  }
}
