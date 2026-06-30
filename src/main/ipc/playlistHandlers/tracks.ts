import path from 'path'
import { getOrCreateSong } from '../../utils/utils.ts'
import {
  getPlaylist,
  invalidatePlaylistCache,
  upsertPlaylistMetadataPreservingName
} from './repository.ts'
import {
  getM3ufilepaths,
  getPlaylistDetails,
  persistPlaylistRecord,
  savePlaylist
} from './m3uFiles.ts'
import { getErrorMessage } from './shared.ts'
import type {
  AddNewSongToPlaylistRequest,
  AppendTracksToPlaylistRequest,
  AppendTracksToPlaylistResult,
  RemoveTrackFromPlaylistRequest,
  UpsertPlaylistMetadataResult
} from '../../Types/playlistHandlers.ts'
import type { ErrorResponse } from '../../Types/shared.ts'
import type { Playlist } from '../../generated/prisma/client.ts'

type TrackMutationResult = UpsertPlaylistMetadataResult | ErrorResponse
type AddNewSongResult = (UpsertPlaylistMetadataResult & { songName?: string }) | ErrorResponse

export async function removeTrackFromPlaylist({
  filePath,
  index
}: RemoveTrackFromPlaylistRequest): Promise<TrackMutationResult> {
  console.log(filePath)

  const filePaths = await getM3ufilepaths(filePath)
  filePaths.splice(index, 1)
  const saveResult = await savePlaylist(filePath, filePaths)
  invalidatePlaylistCache()
  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  console.log('cancion eliminada en:', saveResult.playlistName)
  const playlistDetails = await getPlaylistDetails(filePath)
  console.log('cancion eliminada en:', playlistDetails.totalTracks)
  const playlistData = {
    path: filePath,
    duracion: playlistDetails.totalDuration,
    numElementos: playlistDetails.totalTracks,
    totalplays: 0
  }

  return upsertPlaylistMetadataPreservingName(playlistData.path, playlistData)
}

export async function addNewSongToPlaylist({
  filePath,
  song
}: AddNewSongToPlaylistRequest): Promise<AddNewSongResult> {
  console.log(filePath)

  const filename = path.basename(song)
  await getOrCreateSong(song, filename)

  const filePaths = await getM3ufilepaths(filePath)

  if (filePaths.includes(song)) {
    return {
      success: false,
      error: 'La cancion ya existe en esta playlist.'
    }
  }

  filePaths.push(song)
  const saveResult = await savePlaylist(filePath, filePaths)
  invalidatePlaylistCache()
  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  console.log('cancion agregada en:', saveResult.playlistName)
  const playlistDetails = await getPlaylistDetails(filePath)
  console.log('cancion agregada en:', playlistDetails.totalTracks)
  const playlistData = {
    path: filePath,
    duracion: playlistDetails.totalDuration,
    numElementos: playlistDetails.totalTracks,
    totalplays: 0
  }
  const persistResult = await upsertPlaylistMetadataPreservingName(playlistData.path, playlistData)

  return { ...persistResult, songName: filename }
}

export async function appendTracksToPlaylist({
  playlistPath,
  filePaths = []
}: AppendTracksToPlaylistRequest = {}): Promise<AppendTracksToPlaylistResult> {
  try {
    if (!playlistPath) {
      return { success: false, error: 'playlistPath is required' }
    }

    const existingPaths = await getM3ufilepaths(playlistPath)
    const incomingPaths = Array.isArray(filePaths) ? filePaths : []
    const normalizedIncomingPaths = incomingPaths
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.trim())

    if (normalizedIncomingPaths.length === 0) {
      return { success: false, error: 'There are no songs to add.' }
    }

    const existingSet = new Set(existingPaths)
    const pathsToAppend: string[] = []

    for (const trackPath of normalizedIncomingPaths) {
      if (!existingSet.has(trackPath)) {
        existingSet.add(trackPath)
        pathsToAppend.push(trackPath)
        const filename = path.basename(trackPath)
        await getOrCreateSong(trackPath, filename)
      }
    }

    if (pathsToAppend.length === 0) {
      return {
        success: true,
        addedCount: 0,
        skippedCount: normalizedIncomingPaths.length,
        playlist: (await getPlaylist(playlistPath)) as Playlist | null
      }
    }

    const nextFilePaths = existingPaths.concat(pathsToAppend)
    const saveResult = await savePlaylist(playlistPath, nextFilePaths)
    invalidatePlaylistCache()

    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    const persistResult = await persistPlaylistRecord(playlistPath, { allowExistingPath: true })
    if (!persistResult.success) {
      return { success: false, error: persistResult.error }
    }

    return {
      success: true,
      addedCount: pathsToAppend.length,
      skippedCount: normalizedIncomingPaths.length - pathsToAppend.length,
      playlist: persistResult.playlist
    }
  } catch (error) {
    console.error('Error appending tracks to playlist:', error)
    return { success: false, error: getErrorMessage(error, 'Could not add the songs.') }
  }
}
