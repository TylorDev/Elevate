import { getFileInfos } from '../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import {
  getErrorMessage,
  toDayKey
} from './shared.ts'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  ErrorResponse,
  HistoryAudioFileInfo,
  HistoryPageRequest,
  HistoryPageResult,
  SongHistoryDailyRecord,
  SongHistoryTimelineRequest,
  SongHistoryTimelineResult
} from '../../Types/likeHandlers.ts'

const db = prisma as unknown as PrismaClient
const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>

function isStringTuple(value: [string, string] | null): value is [string, string] {
  return value !== null
}

function normalizeHistoryPageRequest(request: HistoryPageRequest): {
  page: number
  pageSize: number
  offset: number
} {
  const page = Math.max(Number(typeof request === 'object' ? request?.page : request) || 1, 1)
  const pageSize = Math.min(
    Math.max(Number(typeof request === 'object' ? request?.pageSize : undefined) || 10, 1),
    50
  )

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  }
}

export async function getMostPlayedSongsWithDetails(): Promise<string[] | ErrorResponse> {
  try {
    const userPreferences = await db.userPreferences.findMany({
      orderBy: {
        short_view_count: 'desc'
      },
      select: {
        short_view_count: true,
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    const songs = userPreferences.map((record) => ({
      filepath: record.Songs.filepath,
      filename: record.Songs.filename,
      short_view_count: record.short_view_count
    }))
    const paths = songs.map((song) => song.filepath)
    const firstTenPaths = paths.slice(0, 10)
    console.log(firstTenPaths)
    return firstTenPaths
  } catch (error) {
    console.error('Error retrieving most played songs:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function getPlayHistoryOrdered(
  request: HistoryPageRequest = 1
): Promise<HistoryPageResult> {
  const { page, pageSize, offset } = normalizeHistoryPageRequest(request)

  try {
    const uniqueHistoryRows = await db.playHistory.groupBy({
      by: ['song_id']
    })
    const totalRecords = uniqueHistoryRows.length

    const maxPages = Math.ceil(totalRecords / pageSize)

    const playHistoryRecords = await db.playHistory.groupBy({
      by: ['song_id'],
      _max: {
        timestamp: true
      },
      orderBy: [
        {
          _max: {
            timestamp: 'desc'
          }
        },
        {
          song_id: 'desc'
        }
      ],
      take: pageSize,
      skip: offset
    })

    const songIds = playHistoryRecords.map((record) => record.song_id)
    const songs = songIds.length
      ? await db.songs.findMany({
          where: {
            song_id: {
              in: songIds
            }
          },
          select: {
            song_id: true,
            filepath: true
          }
        })
      : []
    const songById = new Map(songs.map((song) => [song.song_id, song]))
    const lastPlayedAtByPath = new Map(
      playHistoryRecords
        .map((record): [string, string] | null => {
          const filePath = songById.get(record.song_id)?.filepath
          const lastPlayedAt = record._max?.timestamp

          return filePath && lastPlayedAt ? [filePath, lastPlayedAt.toISOString()] : null
        })
        .filter(isStringTuple)
    )

    const filePaths = songIds
      .map((songId) => songById.get(songId)?.filepath)
      .filter((filePath): filePath is string => Boolean(filePath))
    const fileInfos: HistoryAudioFileInfo[] = (await getAudioFileInfos(filePaths, {
      includePicture: false
    })).map((fileInfo) => ({
      ...fileInfo,
      lastPlayedAt: lastPlayedAtByPath.get(fileInfo.filePath) || null
    }))

    return {
      items: fileInfos,
      fileInfos,
      page,
      pageSize,
      total: totalRecords,
      maxPages,
      hasMore: offset + fileInfos.length < totalRecords
    }
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function getSongHistoryTimeline(
  request: SongHistoryTimelineRequest = {}
): Promise<SongHistoryTimelineResult> {
  const filePath = typeof request?.filePath === 'string' ? request.filePath : ''

  if (!filePath) {
    return { success: false, error: 'No se recibio una cancion valida.' }
  }

  try {
    const songRecord = await db.songs.findUnique({
      where: { filepath: filePath },
      select: {
        song_id: true,
        filepath: true,
        timestamp: true
      }
    })

    if (!songRecord) {
      return { success: false, error: 'No se encontro esta cancion en la biblioteca.' }
    }

    const historyRecords = await db.playHistory.findMany({
      where: { song_id: songRecord.song_id },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true }
    })
    const events = historyRecords
      .map((record) => record.timestamp?.toISOString?.())
      .filter((timestamp): timestamp is string => Boolean(timestamp))
    const recordsByDay = new Map<string, number>()

    for (const eventTimestamp of events) {
      const dayKey = toDayKey(eventTimestamp)

      if (!dayKey) {
        continue
      }

      recordsByDay.set(dayKey, (recordsByDay.get(dayKey) || 0) + 1)
    }

    const dailyRecords = Array.from(recordsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date))
    const peakDay = dailyRecords.reduce<SongHistoryDailyRecord>(
      (currentPeak, record) => (record.count > currentPeak.count ? record : currentPeak),
      { date: '', count: 0 }
    )
    const fileInfos = await getAudioFileInfos([songRecord.filepath], { includePicture: false })

    return {
      success: true,
      song: fileInfos[0] || {
        song_id: songRecord.song_id,
        filePath: songRecord.filepath
      },
      libraryAddedAt: songRecord.timestamp?.toISOString?.() || null,
      totalRecords: events.length,
      firstPlayedAt: events[0] || null,
      lastPlayedAt: events[events.length - 1] || null,
      peakDay: peakDay.date ? peakDay : null,
      dailyRecords,
      events
    }
  } catch (error) {
    console.error('Error retrieving song history timeline:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function getRecentHistoryOrdered(): Promise<AudioFileInfo[] | ErrorResponse> {
  try {
    const playHistoryRecords = await db.playHistory.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        song_id: true,
        timestamp: true,
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    const uniqueSongs = new Map<number, { filepath: string; filename: string }>()
    playHistoryRecords.forEach((record) => {
      if (!uniqueSongs.has(record.song_id)) {
        uniqueSongs.set(record.song_id, record.Songs)
      }
    })

    const songs = Array.from(uniqueSongs.values())
    const filePaths = songs.map((song) => song.filepath)
    return getAudioFileInfos(filePaths, { includePicture: false })
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
