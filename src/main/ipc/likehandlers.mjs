import { ipcMain } from 'electron'

import { getFileInfos } from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getOrCreateSong(filepath, filename) {
  let song = await prisma.songs.findUnique({ where: { filepath } })

  if (!song) {
    song = await prisma.songs.create({
      data: { filepath, filename }
    })
    console.debug('Song added successfully:', { filepath, filename, songId: song.song_id })
  } else {
    console.debug('Song already exists:', song)
  }

  return song
}

async function markAsFavorite(songId) {
  const favorite = await prisma.userPreferences.findFirst({
    where: { song_id: songId }
  })

  if (!favorite) {
    await prisma.userPreferences.create({
      data: { song_id: songId, is_favorite: true }
    })
    console.debug('Song marked as favorite successfully:', { songId })
  } else {
    console.debug('Song already marked as favorite:', { songId })
  }
}

async function markAsListenLater(songId) {
  await prisma.userPreferences.upsert({
    where: { song_id: songId },
    update: { listen_later: true },
    create: {
      song_id: songId,
      listen_later: true
    }
  })
}

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
      await markAsFavorite(song.song_id)

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unlike-song', async (event, filepath) => {
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

      // Verificar si la canción está marcada como favorita en UserPreferences
      const favorite = await prisma.userPreferences.findUnique({
        where: { song_id: songId }
      })

      if (favorite) {
        // Si la canción está marcada como favorita, eliminar el like
        await prisma.userPreferences.delete({
          where: { song_id: songId }
        })
        console.debug('Song unliked successfully:', { songId })
        return { success: true, songId }
      } else {
        // Si la canción no está marcada como favorita
        console.debug('Song is not marked as favorite:', { songId })
        return { success: false, error: 'Song is not marked as favorite' }
      }
    } catch (error) {
      console.error('Error unliking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-likes', async (event) => {
    try {
      // Obtener todas las preferencias de usuario que están marcadas como favoritas
      const userPreferences = await prisma.userPreferences.findMany({
        where: {
          is_favorite: true
        },
        select: {
          Songs: {
            select: {
              filepath: true,
              filename: true
            }
          }
        }
      })

      // Extraer las canciones favoritas
      const likedSongs = userPreferences.map((preference) => preference.Songs)

      console.debug('Liked songs retrieved successfully:', likedSongs)

      const filePaths = likedSongs.map((song) => song.filepath)
      const fileInfos = await getFileInfos(filePaths)

      return fileInfos
    } catch (error) {
      console.error('Error retrieving liked songs:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('listen-later-song', async (event, filepath, filename) => {
    try {
      // Obtén o crea la canción
      const song = await getOrCreateSong(filepath, filename)

      // Marca la canción como "Listen Later"
      await markAsListenLater(song.song_id)

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error adding song to listen later:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-listen-later', async (event) => {
    try {
      // Obtener todas las preferencias de usuario que están marcadas como "Listen Later"
      const userPreferences = await prisma.userPreferences.findMany({
        where: {
          listen_later: true
        },
        select: {
          Songs: {
            select: {
              filepath: true,
              filename: true
            }
          }
        }
      })

      // Extraer las canciones de "Listen Later"
      const listenLaterSongs = userPreferences.map((preference) => preference.Songs)

      console.debug('Listen Later songs retrieved successfully:', listenLaterSongs)

      const filePaths = listenLaterSongs.map((song) => song.filepath)
      const fileInfos = await getFileInfos(filePaths)

      return fileInfos
    } catch (error) {
      console.error('Error retrieving listen later songs:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('remove-listen-later', async (event, filepath) => {
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

      // Verificar si la canción está marcada como "Listen Later" en UserPreferences
      const preference = await prisma.userPreferences.findUnique({
        where: { song_id: songId }
      })

      if (preference && preference.listen_later) {
        // Si la canción está marcada como "Listen Later", actualizar el estado
        await prisma.userPreferences.update({
          where: { song_id: songId },
          data: { listen_later: false }
        })
        console.debug('Song removed from listen later successfully:', { songId })
        return { success: true, songId }
      } else {
        // Si la canción no está marcada como "Listen Later"
        console.debug('Song is not marked as listen later:', { songId })
        return { success: false, error: 'Song is not marked as listen later' }
      }
    } catch (error) {
      console.error('Error removing song from listen later:', error)
      return { success: false, error: error.message }
    }
  })
}
