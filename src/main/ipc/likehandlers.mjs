import { ipcMain } from 'electron'
import { openDb } from '../../database.mjs'
import { getFileInfos } from './utils/utils.mjs'

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, filepath, filename) => {
    try {
      console.debug('Attempting to like song:', { filename, filepath })
      const db = await openDb()
      console.debug('Database opened successfully.')

      // Verificar si la canción ya existe en la tabla Songs
      const song = await db.get('SELECT song_id FROM Songs WHERE filepath = ?', [filepath])
      let songId

      if (song) {
        // Si la canción existe, obtener el song_id
        console.debug('Song already exists:', song)
        songId = song.song_id
      } else {
        // Si la canción no existe, agregarla a la tabla Songs
        const result = await db.run('INSERT INTO Songs (filepath, filename) VALUES (?, ?)', [
          filepath,
          filename
        ])
        songId = result.lastID
        console.debug('Song added successfully:', { filepath, filename, songId })
      }

      // Marcar la canción como favorita en UserPreferences
      const favorite = await db.get(
        'SELECT user_preference_id FROM UserPreferences WHERE song_id = ?',
        [songId]
      )
      if (favorite) {
        // Si ya está marcada como favorita, no hacer nada
        console.debug('Song already marked as favorite:', { songId })
      } else {
        // Si no está marcada como favorita, agregarla
        await db.run('INSERT INTO UserPreferences (song_id, is_favorite) VALUES (?, ?)', [
          songId,
          1
        ])
        console.debug('Song marked as favorite successfully:', { songId })
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
      const db = await openDb()
      console.debug('Database opened successfully.')

      // Verificar si la canción existe en la tabla Songs
      const song = await db.get('SELECT song_id FROM Songs WHERE filepath = ?', [filepath])
      if (!song) {
        console.debug('Song not found:', { filepath })
        return { success: false, error: 'Song not found' }
      }

      const songId = song.song_id

      // Verificar si la canción está marcada como favorita en UserPreferences
      const favorite = await db.get(
        'SELECT user_preference_id FROM UserPreferences WHERE song_id = ?',
        [songId]
      )
      if (favorite) {
        // Si la canción está marcada como favorita, eliminar el like
        await db.run('DELETE FROM UserPreferences WHERE song_id = ?', [songId])
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
      const db = await openDb()
      console.debug('Database opened successfully.')

      // Obtener todas las canciones marcadas como favoritas
      const likedSongs = await db.all(`
            SELECT s.filepath, s.filename 
            FROM Songs s
            JOIN UserPreferences up ON s.song_id = up.song_id 
            WHERE up.is_favorite = 1
          `)

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
