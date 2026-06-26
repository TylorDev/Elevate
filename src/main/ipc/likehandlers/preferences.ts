// @ts-nocheck
import {
  getFileInfos,
  getOrCreateSong
} from '../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import { withoutPictures } from './shared.ts'

export async function markUserPreference(songId, preferenceField, preferenceValue = true) {
  await prisma.userPreferences.upsert({
    where: { song_id: songId },
    update: { [preferenceField]: preferenceValue },
    create: {
      song_id: songId,
      [preferenceField]: preferenceValue
    }
  })
}

export async function isSongLiked(songId) {
  const preference = await prisma.userPreferences.findUnique({
    where: { song_id: songId },
    select: { is_favorite: true }
  })
  return preference?.is_favorite || false
}

export async function getUserPreferencesByCriteria(criteria) {
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

    // Extraer las canciones segun el criterio
    const songs = userPreferences.map((preference) => preference.Songs)

    console.debug(`Songs count:`, songs.length)

    const filePaths = songs.map((song) => song.filepath)
    const coverData = await getFileInfos(filePaths)
    const tracks = withoutPictures(coverData)
    const cover = await generateCollectionCoverFromTracks(tracks)
    const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
    return { fileInfos: tracks, cover, totalDuration }
  } catch (error) {
    console.error('Error retrieving songs:', error)
    return { success: false, error: error.message }
  }
}

export async function updateSongPreference(filepath, updateAction, updateData) {
  try {
    // Verificar si la cancion existe en la tabla Songs
    const song = await prisma.songs.findUnique({
      where: { filepath }
    })

    if (!song) {
      console.debug('Song not found:', { filepath })
      return { success: false, error: 'Song not found' }
    }

    const songId = song.song_id

    // Verificar el estado actual de la cancion en UserPreferences
    const preference = await prisma.userPreferences.findUnique({
      where: { song_id: songId }
    })

    if (preference) {
      // Realizar la accion de actualizacion o eliminacion segun el caso
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

export async function likeSong(common) {
  try {
    console.debug(common.fileName)
    const song = await getOrCreateSong(common.filePath, common.fileName)
    await markUserPreference(song.song_id, 'is_favorite')

    return { success: true, songId: song.song_id }
  } catch (error) {
    console.error('Error liking song:', error)
    return { success: false, error: error.message }
  }
}

export async function checkSongLiked(filepath, filename) {
  try {
    const song = await getOrCreateSong(filepath, filename)
    const liked = await isSongLiked(song.song_id)

    return { success: true, liked }
  } catch (error) {
    console.error('Error checking if song is liked:', error)
    return { success: false, error: error.message }
  }
}

export function unlikeSong(common) {
  return updateSongPreference(common.filePath, async (songId) => {
    await prisma.userPreferences.update({
      where: { song_id: songId },
      data: { is_favorite: false }
    })
  })
}

export async function getLikes() {
  return await getUserPreferencesByCriteria({ is_favorite: true })
}

export async function getLikesNumber() {
  try {
    // Obtener la cantidad total de preferencias de usuario que cumplen con el criterio
    const totalLikes = await prisma.userPreferences.count({
      where: { is_favorite: true }
    })

    return totalLikes // Devolver solo el numero total de likes
  } catch (error) {
    console.error('Error retrieving likes:', error)
    throw error
  }
}

export async function listenLaterSong(filepath, filename) {
  try {
    // Obten o crea la cancion
    const song = await getOrCreateSong(filepath, filename)

    await markUserPreference(song.song_id, 'listen_later')

    return { success: true, songId: song.song_id }
  } catch (error) {
    console.error('Error adding song to listen later:', error)
    return { success: false, error: error.message }
  }
}

export function getListenLater() {
  return getUserPreferencesByCriteria({ listen_later: true })
}

export function removeListenLater(filepath, filename) {
  return updateSongPreference(filepath, async (songId) => {
    // Actualizar el estado "Listen Later"
    await prisma.userPreferences.update({
      where: { song_id: songId },
      data: { listen_later: false }
    })
  })
}
