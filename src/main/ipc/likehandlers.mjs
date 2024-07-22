import { ipcMain } from 'electron'
import { openDb } from '../../database.mjs'
import { getFileInfos } from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, filepath, filename) => {
    try {
      console.debug('Attempting to like song:', { filename, filepath })

      // Verificar si la canción ya existe en la tabla Songs
      let song = await prisma.songs.findUnique({
        where: { filepath }
      })

      if (!song) {
        // Si la canción no existe, agregarla a la tabla Songs
        song = await prisma.songs.create({
          data: {
            filepath,
            filename
          }
        })
        console.debug('Song added successfully:', { filepath, filename, songId: song.song_id })
      } else {
        console.debug('Song already exists:', song)
      }

      const songId = song.song_id

      // Marcar la canción como favorita en UserPreferences
      const favorite = await prisma.userPreferences.findUnique({
        where: { song_id: songId }
      })

      if (!favorite) {
        // Si no está marcada como favorita, agregarla
        await prisma.userPreferences.create({
          data: {
            song_id: songId,
            is_favorite: true
          }
        })
        console.debug('Song marked as favorite successfully:', { songId })
      } else {
        console.debug('Song already marked as favorite:', { songId })
      }

      return { success: true, songId }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unlike-song', async (event, filepath) => {
    try {
      console.debug('Attempting to unlike song:', { filepath })

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
      console.debug('Attempting to get liked songs')

      // Obtener todas las canciones marcadas como favoritas
      const likedSongs = await prisma.songs.findMany({
        where: {
          userPreferences: {
            some: {
              is_favorite: true
            }
          }
        },
        select: {
          filepath: true,
          filename: true
        }
      })

      console.debug('Liked songs retrieved successfully:', likedSongs)

      const filePaths = likedSongs.map((song) => song.filepath)
      const fileInfos = await getFileInfos(filePaths)

      return fileInfos
    } catch (error) {
      console.error('Error retrieving liked songs:', error)
      return { success: false, error: error.message }
    }
  })
}
