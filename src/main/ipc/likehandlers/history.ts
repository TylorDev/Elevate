// @ts-nocheck
import { getFileInfos } from '../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import { toDayKey } from './shared.ts'

export async function getMostPlayedSongsWithDetails() {
  try {
    const userPreferences = await prisma.userPreferences.findMany({
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

    // Extraer las canciones mas escuchadas con detalles adicionales (filepath y filename)
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
    return { success: false, error: error.message }
  }
}

export async function getPlayHistoryOrdered(request = 1) {
  const page = Math.max(Number(request?.page ?? request) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 10, 1), 50)
  const offset = (page - 1) * pageSize

  try {
    const uniqueHistoryRows = await prisma.playHistory.groupBy({
      by: ['song_id']
    })
    const totalRecords = uniqueHistoryRows.length

    const maxPages = Math.ceil(totalRecords / pageSize)

    const playHistoryRecords = await prisma.playHistory.groupBy({
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
      ? await prisma.songs.findMany({
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
        .map((record) => {
          const filePath = songById.get(record.song_id)?.filepath
          const lastPlayedAt = record._max?.timestamp

          return filePath && lastPlayedAt ? [filePath, lastPlayedAt.toISOString()] : null
        })
        .filter(Boolean)
    )

    const filePaths = songIds.map((songId) => songById.get(songId)?.filepath).filter(Boolean)
    const fileInfos = (await getFileInfos(filePaths, { includePicture: false })).map((fileInfo) => ({
      ...fileInfo,
      lastPlayedAt: lastPlayedAtByPath.get(fileInfo.filePath) || null
    }))

    return {
      fileInfos,
      page,
      pageSize,
      total: totalRecords,
      maxPages,
      hasMore: offset + fileInfos.length < totalRecords
    }
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}

export async function getSongHistoryTimeline(request = {}) {
  const filePath = typeof request?.filePath === 'string' ? request.filePath : ''

  if (!filePath) {
    return { success: false, error: 'No se recibio una cancion valida.' }
  }

  try {
    const songRecord = await prisma.songs.findUnique({
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

    const historyRecords = await prisma.playHistory.findMany({
      where: { song_id: songRecord.song_id },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true }
    })
    const events = historyRecords
      .map((record) => record.timestamp?.toISOString?.())
      .filter(Boolean)
    const recordsByDay = new Map()

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
    const peakDay =
      dailyRecords.reduce(
        (currentPeak, record) => (record.count > currentPeak.count ? record : currentPeak),
        { date: null, count: 0 }
      ) || null
    const fileInfos = await getFileInfos([songRecord.filepath], { includePicture: false })

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
    return { success: false, error: error.message }
  }
}

export async function getRecentHistoryOrdered() {
  try {
    // Obtener todos los registros de PlayHistory ordenados por el campo timestamp mas reciente
    const playHistoryRecords = await prisma.playHistory.findMany({
      orderBy: {
        timestamp: 'desc' // Ordenar de mas reciente a mas antiguo
      },
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para informacion adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Filtrar canciones unicas basadas en el song_id y obtener la mas reciente
    const uniqueSongs = new Map()
    playHistoryRecords.forEach((record) => {
      if (!uniqueSongs.has(record.song_id)) {
        uniqueSongs.set(record.song_id, record.Songs)
      }
    })

    // Convertir el Map a un array de canciones
    const songs = Array.from(uniqueSongs.values())

    // Opcional: Si necesitas informacion adicional de las canciones, puedes obtenerla aqui
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths, { includePicture: false })

    return fileInfos
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}
