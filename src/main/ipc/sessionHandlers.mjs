import { ipcMain } from 'electron'
import { prisma } from '../prisma.mjs'

export function setupSessionHandlers() {
  ipcMain.handle('player-session:save', async (event, data) => {
    try {
      const { song_id, position_sec, resume_from_start, queue_type, queue_source, queue_song_ids, queue_index } = data

      await prisma.playerSession.upsert({
        where: { id: 1 },
        update: {
          song_id,
          position_sec,
          resume_from_start,
          queue_type,
          queue_source,
          queue_song_ids: JSON.stringify(queue_song_ids || []),
          queue_index,
        },
        create: {
          id: 1,
          song_id,
          position_sec,
          resume_from_start,
          queue_type,
          queue_source,
          queue_song_ids: JSON.stringify(queue_song_ids || []),
          queue_index,
        }
      })
      return { success: true }
    } catch (error) {
      console.error('Error saving player session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('player-session:load', async () => {
    try {
      const session = await prisma.playerSession.findUnique({
        where: { id: 1 }
      })

      if (!session) return { success: true, session: null }

      // Resolver las canciones completas para la cola
      let queue_songs = []
      try {
        const songIds = JSON.parse(session.queue_song_ids)
        if (Array.isArray(songIds) && songIds.length > 0) {
          const songsFromDb = await prisma.songs.findMany({
            where: { song_id: { in: songIds } }
          })
          
          // Mantener el orden exacto del array
          const songMap = new Map(songsFromDb.map(s => [s.song_id, s]))
          queue_songs = songIds.map(id => songMap.get(id)).filter(Boolean)
        }
      } catch (e) {
        console.error('Failed to parse queue_song_ids:', e)
      }

      let currentSong = null
      if (session.song_id) {
        currentSong = await prisma.songs.findUnique({
          where: { song_id: session.song_id }
        })
      }

      return { 
        success: true, 
        session: {
          ...session,
          queue_song_ids: JSON.parse(session.queue_song_ids || '[]')
        },
        queue_songs,
        currentSong
      }
    } catch (error) {
      console.error('Error loading player session:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('player-session:clear', async () => {
    try {
      await prisma.playerSession.upsert({
        where: { id: 1 },
        update: {
          song_id: null,
          position_sec: 0,
          resume_from_start: true,
          queue_type: 'NONE',
          queue_source: null,
          queue_song_ids: '[]',
          queue_index: 0
        },
        create: {
          id: 1,
          song_id: null,
          position_sec: 0,
          resume_from_start: true,
          queue_type: 'NONE',
          queue_source: null,
          queue_song_ids: '[]',
          queue_index: 0
        }
      })
      return { success: true }
    } catch (error) {
      console.error('Error clearing player session:', error)
      return { success: false, error: error.message }
    }
  })
}
