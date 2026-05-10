import { createRequire } from 'node:module'

import { generateCover, getFileInfos, getOrCreateSong } from './utils/utils.mjs'
import { prisma } from '../prisma.mjs'

import { getSongBpm } from './utils/utils.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { ipcMain } = electron

function withoutPictures(fileInfos) {
  return fileInfos.map((fileInfo) => ({ ...fileInfo, picture: undefined }))
}

async function markUserPreference(songId, preferenceField, preferenceValue = true) {
  await prisma.userPreferences.upsert({
    where: { song_id: songId },
    update: { [preferenceField]: preferenceValue },
    create: {
      song_id: songId,
      [preferenceField]: preferenceValue
    }
  })
}

async function isSongLiked(songId) {
  const preference = await prisma.userPreferences.findUnique({
    where: { song_id: songId },
    select: { is_favorite: true }
  })
  return preference?.is_favorite || false
}

async function getUserPreferencesByCriteria(criteria) {
  try {
    // Obtener todas las preferencias de usuario que cumplen con el criterio
    const userPreferences = await prisma.userPreferences.findMany({
      where: criteria,
      select: {
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer las canciones según el criterio
    const songs = userPreferences.map((preference) => preference.Songs)

    console.debug(`Songs count:`, songs.length)

    const filePaths = songs.map((song) => song.filepath)
    const coverData = await getFileInfos(filePaths)
    const cover = await generateCover(coverData)
    const tracks = withoutPictures(coverData)
    const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
    return { fileInfos: tracks, cover, totalDuration }
  } catch (error) {
    console.error('Error retrieving songs:', error)
    return { success: false, error: error.message }
  }
}

async function updateSongPreference(filepath, updateAction, updateData) {
  try {
    // Verificar si la canción existe en la tabla Songs
    const song = await prisma.songs.findUnique({
      where: { filepath }
    })

    if (!song) {
      console.debug('Song not found:', { filepath })
      return { success: false, error: 'Song not found' }
    }

    const songId = song.song_id

    // Verificar el estado actual de la canción en UserPreferences
    const preference = await prisma.userPreferences.findUnique({
      where: { song_id: songId }
    })

    if (preference) {
      // Realizar la acción de actualización o eliminación según el caso
      await updateAction(songId, updateData)
      console.debug('Song updated successfully:', { songId })
      return { success: true, songId }
    } else {
      console.debug('Song not found in user preferences:', { filepath })
      return { success: false, error: 'Song not found in user preferences' }
    }
  } catch (error) {
    console.error('Error updating song preference:', error)
    return { success: false, error: error.message }
  }
}

async function addPlayHistory(song_id) {
  try {
    // Upsert UserPreference: Si no existe, se crea con valores predeterminados.
    await prisma.userPreferences.upsert({
      where: { song_id },
      update: {
        play_count: {
          increment: 1
        }
      },
      create: {
        song_id,
        play_count: 1 // Inicializa play_count en 1
      }
    })

    // Crear un nuevo registro en PlayHistory
    await prisma.playHistory.create({
      data: {
        song_id
      }
    })

    console.log(`Play history updated for song_id: ${song_id}`)
  } catch (error) {
    console.error('Error updating play history:', error)
  }
}

async function getMostPlayedSongsWithDetails() {
  try {
    // Obtener todos los registros de canciones ordenadas por play_count en orden descendente
    const userPreferences = await prisma.userPreferences.findMany({
      orderBy: {
        play_count: 'desc' // Ordenar por el conteo de reproducciones
      },
      select: {
        play_count: true,
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer las canciones más escuchadas con detalles adicionales (filepath y filename)
    const songs = userPreferences.map((record) => ({
      filepath: record.Songs.filepath,
      filename: record.Songs.filename,
      play_count: record.play_count
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
async function getPlayHistoryOrdered(page = 1) {
  const pageSize = 10 // Número de elementos por página

  try {
    // Contar el total de registros en PlayHistory
    const totalRecords = await prisma.playHistory.count()

    // Calcular el número máximo de páginas
    const maxPages = Math.ceil(totalRecords / pageSize)

    // Obtener solo 10 registros de PlayHistory ordenados por el campo timestamp más reciente
    const playHistoryRecords = await prisma.playHistory.findMany({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      take: pageSize, // Limitar a 10 registros
      skip: (page - 1) * pageSize, // Omitir elementos según la página
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer canciones según el historial de reproducción
    const songs = playHistoryRecords.map((record) => record.Songs)

    // Obtener información adicional de las canciones
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths, { includePicture: false })

    return { fileInfos, maxPages }
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}

async function getRecentHistoryOrdered() {
  try {
    // Obtener todos los registros de PlayHistory ordenados por el campo timestamp más reciente
    const playHistoryRecords = await prisma.playHistory.findMany({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Filtrar canciones únicas basadas en el song_id y obtener la más reciente
    const uniqueSongs = new Map()
    playHistoryRecords.forEach((record) => {
      if (!uniqueSongs.has(record.song_id)) {
        uniqueSongs.set(record.song_id, record.Songs)
      }
    })

    // Convertir el Map a un array de canciones
    const songs = Array.from(uniqueSongs.values())

    // Opcional: Si necesitas información adicional de las canciones, puedes obtenerla aquí
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths, { includePicture: false })

    return fileInfos
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}

async function getLatestPlayHistoryRecord() {
  try {
    // Obtener el registro más reciente de PlayHistory ordenado por el campo timestamp
    const latestPlayHistoryRecord = await prisma.playHistory.findFirst({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    if (!latestPlayHistoryRecord) {
      return { success: false, message: 'No play history records found.' }
    }

    // console.debug('Latest play history record:', latestPlayHistoryRecord)

    // Opcional: Si necesitas información adicional de la canción, puedes obtenerla aquí
    const fileInfos = await getFileInfos([latestPlayHistoryRecord.Songs.filepath], {
      includePicture: false
    })

    return fileInfos.length > 0 ? fileInfos[0] : null
  } catch (error) {
    console.error('Error retrieving latest play history record:', error)
    return { success: false, error: error.message }
  }
}
function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

function getSongSearchPriority(song, normalizedQuery, filters) {
  const loweredQuery = normalizedQuery.toLocaleLowerCase()
  const title = String(song.title || '').toLocaleLowerCase()
  const filename = String(song.filename || '').toLocaleLowerCase()
  const artist = String(song.artist || '').toLocaleLowerCase()

  if (filters.name && (title.includes(loweredQuery) || filename.includes(loweredQuery))) {
    return 0
  }

  if (filters.artist && artist.includes(loweredQuery)) {
    return 1
  }

  return 2
}

async function searchSongsPage(request = {}) {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 50, 1), 100)
  const filters = {
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

  const clauses = []

  if (filters.name) {
    clauses.push({ title: { contains: query } }, { filename: { contains: query } })
  }

  if (filters.artist) {
    clauses.push({ artist: { contains: query } })
  }

  const whereClause = { OR: clauses }
  const offset = (page - 1) * pageSize

  try {
    const [songs, total] = await Promise.all([
      prisma.songs.findMany({
        where: whereClause,
        include: {
          UserPreferences: {
            select: {
              play_count: true
            }
          }
        }
      }),
      prisma.songs.count({
        where: whereClause
      })
    ])

    const sortedSongs = songs
      .slice()
      .sort((left, right) => {
        const leftPriority = getSongSearchPriority(left, query, filters)
        const rightPriority = getSongSearchPriority(right, query, filters)

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        const leftName = String(left.title || left.filename || '').toLocaleLowerCase()
        const rightName = String(right.title || right.filename || '').toLocaleLowerCase()

        if (leftName !== rightName) {
          return leftName.localeCompare(rightName)
        }

        const leftArtist = String(left.artist || '').toLocaleLowerCase()
        const rightArtist = String(right.artist || '').toLocaleLowerCase()

        if (leftArtist !== rightArtist) {
          return leftArtist.localeCompare(rightArtist)
        }

        return left.song_id - right.song_id
      })

    const paginatedSongs = sortedSongs.slice(offset, offset + pageSize)
    const items = Array.isArray(paginatedSongs)
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
          play_count: Number(song.UserPreferences?.[0]?.play_count) || 0
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

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, common) => {
    try {
      console.debug(common.fileName)
      const song = await getOrCreateSong(common.filePath, common.fileName)
      await markUserPreference(song.song_id, 'is_favorite')

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('is-song-liked', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
      const liked = await isSongLiked(song.song_id)

      return { success: true, liked }
    } catch (error) {
      console.error('Error checking if song is liked:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('add-history', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
      await addPlayHistory(song.song_id)

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unlike-song', (event, common) => {
    return updateSongPreference(common.filePath, async (songId) => {
      await prisma.userPreferences.update({
        where: { song_id: songId },
        data: { is_favorite: false }
      })
    })
  })

  ipcMain.handle('get-likes', async (event) => {
    return await getUserPreferencesByCriteria({ is_favorite: true })
  })

  ipcMain.handle('get-likes-number', async (event) => {
    try {
      // Obtener la cantidad total de preferencias de usuario que cumplen con el criterio
      const totalLikes = await prisma.userPreferences.count({
        where: { is_favorite: true }
      })

      return totalLikes // Devolver solo el número total de likes
    } catch (error) {
      console.error('Error retrieving likes:', error)
      throw error
    }
  })

  ipcMain.handle('listen-later-song', async (event, filepath, filename) => {
    try {
      // Obtén o crea la canción
      const song = await getOrCreateSong(filepath, filename)

      await markUserPreference(song.song_id, 'listen_later')

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error adding song to listen later:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-listen-later', async (event) => {
    return getUserPreferencesByCriteria({ listen_later: true })
  })

  ipcMain.handle('get-history', async (event, page) => {
    return getPlayHistoryOrdered(page)
  })

  ipcMain.handle('get-recents', async (event) => {
    const likes = await getRecentHistoryOrdered()
    return likes.slice(0, 5) // Mostrar solo los primeros 5 elementos únicos
  })

  ipcMain.handle('get-lastest', async (event) => {
    return getLatestPlayHistoryRecord()
  })

  ipcMain.handle('get-most-played', async (event) => {
    const paths = await getMostPlayedSongsWithDetails()
    return getFileInfos(paths, { includePicture: false })
  })

  ipcMain.handle('remove-listen-later', (event, filepath, filename) => {
    return updateSongPreference(filepath, async (songId) => {
      // Actualizar el estado "Listen Later"
      await prisma.userPreferences.update({
        where: { song_id: songId },
        data: { listen_later: false }
      })
    })
  })
}

export function setupMusicHandlers() {
  ipcMain.handle('get-bpm', async (event, common) => {
    try {
      const { filePath, fileName } = common
      const fileInfo = await getSongBpm(common)

      console.log('recibido[getbpm-Handler]', fileInfo.bpm) // Verifica que fileInfo.bpm tenga el valor correcto

      const song = await getOrCreateSong(filePath, fileName)
      await markUserPreference(song.song_id, 'bpm', parseInt(fileInfo.bpm))

      return fileInfo
    } catch (error) {
      console.error(`Error in get-bpm handler:`, error)
      throw error
    }
  })

  ipcMain.handle('search-songs-page', async (event, request) => {
    return searchSongsPage(request)
  })
}
