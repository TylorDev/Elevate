import { getFileInfos, getOrCreateSong } from '../../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import { getErrorMessage, withoutPictures } from './shared.ts'
import type { Prisma, PrismaClient, Songs } from '../../generated/prisma/client.ts'
import type {
  LikeSongPayload,
  PreferenceCollectionResult,
  PreferenceCriteria,
  PreferenceField,
  SongLikedResult,
  SongPreferenceMutationResult,
  UpdateSongPreferenceAction
} from '../../Types/likeHandlers.ts'
import type { AudioFileInfo } from '../../Types/filehandlers.ts'

const db = prisma as unknown as PrismaClient
const getSong = getOrCreateSong as (
  filepath?: string | null,
  filename?: string | null
) => Promise<Songs>
const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>
const generateCollectionCover = generateCollectionCoverFromTracks as (
  tracks: AudioFileInfo[]
) => Promise<Buffer | null>

export async function markUserPreference(
  songId: number,
  preferenceField: PreferenceField,
  preferenceValue = true
): Promise<void> {
  const preferenceData = {
    [preferenceField]: preferenceValue
  }

  await db.userPreferences.upsert({
    where: { song_id: songId },
    update: preferenceData as Prisma.UserPreferencesUncheckedUpdateInput,
    create: {
      song_id: songId,
      ...preferenceData
    } as Prisma.UserPreferencesUncheckedCreateInput
  })
}

export async function isSongLiked(songId: number): Promise<boolean> {
  const preference = await db.userPreferences.findUnique({
    where: { song_id: songId },
    select: { is_favorite: true }
  })
  return preference?.is_favorite || false
}

export async function getUserPreferencesByCriteria(
  criteria: PreferenceCriteria
): Promise<PreferenceCollectionResult> {
  try {
    const userPreferences = await db.userPreferences.findMany({
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

    const songs = userPreferences.map((preference) => preference.Songs)

    console.debug('Songs count:', songs.length)

    const filePaths = songs.map((song) => song.filepath)
    const coverData = await getAudioFileInfos(filePaths)
    const tracks = withoutPictures(coverData)
    const cover = await generateCollectionCover(tracks)
    const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
    return { fileInfos: tracks, cover, totalDuration }
  } catch (error) {
    console.error('Error retrieving songs:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function updateSongPreference(
  filepath: string | null | undefined,
  updateAction: UpdateSongPreferenceAction,
  updateData?: unknown
): Promise<SongPreferenceMutationResult> {
  try {
    const song = await db.songs.findUnique({
      where: { filepath: filepath || '' }
    })

    if (!song) {
      console.debug('Song not found:', { filepath })
      return { success: false, error: 'Song not found' }
    }

    const songId = song.song_id

    const preference = await db.userPreferences.findUnique({
      where: { song_id: songId }
    })

    if (preference) {
      await updateAction(songId, updateData)
      console.debug('Song updated successfully:', { songId })
      return { success: true, songId }
    }

    console.debug('Song not found in user preferences:', { filepath })
    return { success: false, error: 'Song not found in user preferences' }
  } catch (error) {
    console.error('Error updating song preference:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function likeSong(common: LikeSongPayload): Promise<SongPreferenceMutationResult> {
  try {
    console.debug(common.fileName)
    const song = await getSong(common.filePath, common.fileName)
    await markUserPreference(song.song_id, 'is_favorite')

    return { success: true, songId: song.song_id }
  } catch (error) {
    console.error('Error liking song:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function checkSongLiked(
  filepath?: string | null,
  filename?: string | null
): Promise<SongLikedResult> {
  try {
    const song = await getSong(filepath, filename)
    const liked = await isSongLiked(song.song_id)

    return { success: true, liked }
  } catch (error) {
    console.error('Error checking if song is liked:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export function unlikeSong(common: LikeSongPayload): Promise<SongPreferenceMutationResult> {
  return updateSongPreference(common.filePath, async (songId) => {
    await db.userPreferences.update({
      where: { song_id: songId },
      data: { is_favorite: false }
    })
  })
}

export async function getLikes(): Promise<PreferenceCollectionResult> {
  return getUserPreferencesByCriteria({ is_favorite: true })
}

export async function getLikesNumber(): Promise<number> {
  try {
    return db.userPreferences.count({
      where: { is_favorite: true }
    })
  } catch (error) {
    console.error('Error retrieving likes:', error)
    throw error
  }
}

export async function listenLaterSong(
  filepath?: string | null,
  filename?: string | null
): Promise<SongPreferenceMutationResult> {
  try {
    const song = await getSong(filepath, filename)

    await markUserPreference(song.song_id, 'listen_later')

    return { success: true, songId: song.song_id }
  } catch (error) {
    console.error('Error adding song to listen later:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export function getListenLater(): Promise<PreferenceCollectionResult> {
  return getUserPreferencesByCriteria({ listen_later: true })
}

export function removeListenLater(filepath?: string | null): Promise<SongPreferenceMutationResult> {
  return updateSongPreference(filepath, async (songId) => {
    await db.userPreferences.update({
      where: { song_id: songId },
      data: { listen_later: false }
    })
  })
}
