import { ipcMain } from 'electron'

import { getFileInfos } from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getOrCreateSong(filepath, filename) {
  // Upsert the song
  const song = await prisma.songs.upsert({
    where: { filepath },
    update: {}, // No actualizamos nada si la canción ya existe
    create: { filepath, filename }
  })

  // Check if the song is newly created
  if (song.createdAt) {
    console.debug('Song added successfully:', { filepath, filename, songId: song.song_id })

    // Create UserPreferences if the song is new
    await prisma.userPreferences.create({
      data: {
        song_id: song.song_id
        // You can set other default values if needed
      }
    })

    console.debug('User preferences created for new song:', { songId: song.song_id })
  } else {
    console.debug('Song already exists:', song)
  }

  return song
}

async function markUserPreference(songId, preferenceField) {
  await prisma.userPreferences.upsert({
    where: { song_id: songId },
    update: { [preferenceField]: true },
    create: {
      song_id: songId,
      [preferenceField]: true
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

    console.debug(`PlayHistory count:`, playHistoryRecords.length)

    // Opcional: Si necesitas información adicional de las canciones, puedes obtenerla aquí
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths)

    return fileInfos
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
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
