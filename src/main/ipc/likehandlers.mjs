import { ipcMain } from 'electron'

import { getFileInfos, getOrCreateSong } from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'

import { getSongBpm } from './utils/utils.mjs'
export const prisma = new PrismaClient()

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
    const fileInfos = await getFileInfos(filePaths)

    return fileInfos
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
      console.debug('Song not found in user preferences:', { songId })
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
async function getPlayHistoryOrdered() {
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

    // Extraer canciones según el historial de reproducción
    const songs = playHistoryRecords.map((record) => record.Songs)

    // Opcional: Si necesitas información adicional de las canciones, puedes obtenerla aquí
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths)

    return fileInfos
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
    const fileInfos = await getFileInfos(filePaths)

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
    const fileInfos = await getFileInfos([latestPlayHistoryRecord.Songs.filepath])

    return fileInfos.length > 0 ? fileInfos[0] : null
  } catch (error) {
    console.error('Error retrieving latest play history record:', error)
    return { success: false, error: error.message }
  }
}
async function searchSongPathsByName(searchText) {
  try {
    const songs = await prisma.songs.findMany({
      where: {
        filename: {
          contains: searchText
        }
      },
      select: {
        filepath: true // Selecciona solo el campo filepath
      }
    })

    // Extrae solo los paths de los resultados
    const paths = Array.isArray(songs) ? songs.map((song) => song.filepath) : []

    return paths
  } catch (error) {
    console.error('Error al buscar canciones:', error)
    throw error
  }
}

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
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

  ipcMain.handle('unlike-song', (event, filepath, filename) => {
    return updateSongPreference(filepath, async (songId) => {
      await prisma.userPreferences.update({
        where: { song_id: songId },
        data: { is_favorite: false }
      })
    })
  })

  ipcMain.handle('get-likes', async (event) => {
    return getUserPreferencesByCriteria({ is_favorite: true })
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

  ipcMain.handle('get-history', async (event) => {
    return getPlayHistoryOrdered()
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
    return getFileInfos(paths)
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
  ipcMain.handle('getbpm', async (event, common) => {
    try {
      const { filePath, fileName } = common
      const fileInfo = await getSongBpm(common)

      console.log('recibido[getbpm-Handler]', fileInfo.bpm) // Verifica que fileInfo.bpm tenga el valor correcto

      const song = await getOrCreateSong(filePath, fileName)
      await markUserPreference(song.song_id, 'bpm', parseInt(fileInfo.bpm))

      return fileInfo
    } catch (error) {
      console.error(`Error in getbpm handler:`, error)
      throw error
    }
  })

  ipcMain.handle('search', async (event, query) => {
    const results = await searchSongPathsByName(query)
    console.debug(results)
    const fileInfos = await getFileInfos(results)
    return fileInfos
  })
}
