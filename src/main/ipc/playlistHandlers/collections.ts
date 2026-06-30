import path from 'path'
import { buildCollectionSummaryFromFileInfos, processPlaylist } from '../../utils/utils.ts'
import {
  buildCoverConfig,
  getEffectiveCover,
  getTop10SuggestedCovers
} from './covers.ts'
import { getPlaylist } from './repository.ts'
import {
  buildInsightRankingsFromTracks,
  extractPlaylistName,
  normalizePageRequest
} from './shared.ts'
import type {
  AudioCoverPayload,
  AudioFileInfo,
  PageRequest,
  PlaylistCollectionSummary,
  PlaylistEditPayload,
  PlaylistListPayload,
  PlaylistOverviewResult,
  PlaylistTracksPage
} from '../../Types/playlistHandlers.ts'

const processPlaylistTracks = processPlaylist as (
  filepath: string,
  baseDir: string,
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>
const buildPlaylistCollectionSummary = buildCollectionSummaryFromFileInfos as (
  tracks: AudioFileInfo[],
  extras?: Record<string, unknown>
) => PlaylistCollectionSummary

function stripPictures(tracks: AudioFileInfo[]): AudioFileInfo[] {
  return tracks.map((song) => ({
    ...song,
    picture: undefined
  }))
}

export async function getPlaylistOverview(
  filepath: string,
  request: PageRequest = {}
): Promise<PlaylistOverviewResult> {
  const baseDir = path.dirname(filepath)
  const tracks = stripPictures(await processPlaylistTracks(filepath, baseDir))
  const playlistData = await getPlaylist(filepath)
  const effectiveCover =
    playlistData?.customCoverHash || playlistData?.customCoverMode
      ? await getEffectiveCover(playlistData, null)
      : null
  const resolvedCover = effectiveCover
  const summary = buildPlaylistCollectionSummary(tracks, {
    sourcePath: filepath,
    cover: resolvedCover
  })

  return {
    success: true,
    type: 'playlist',
    meta: {
      title: playlistData?.nombre || extractPlaylistName(filepath),
      sourcePath: filepath,
      createdAt: playlistData?.createdAt || null,
      totalplays: playlistData?.totalplays || 0,
      editable: true
    },
    summary,
    rankings: buildInsightRankingsFromTracks(tracks, request),
    playlistData,
    cover: null,
    suggestedCovers: [],
    effectiveCover: resolvedCover,
    coverConfig: buildCoverConfig(playlistData)
  }
}

export async function getPlaylistTracksPage(
  filepath: string,
  request: PageRequest = {}
): Promise<PlaylistTracksPage> {
  const { page, pageSize } = normalizePageRequest(request)
  const baseDir = path.dirname(filepath)
  const tracks = stripPictures(await processPlaylistTracks(filepath, baseDir))
  const offset = (page - 1) * pageSize
  const items = tracks.slice(offset, offset + pageSize)

  return {
    items,
    page,
    pageSize,
    total: tracks.length,
    hasMore: offset + items.length < tracks.length
  }
}

export async function getPlaylistEditPayload(filepath: string): Promise<PlaylistEditPayload> {
  const playlistData = await getPlaylist(filepath)

  if (!playlistData) {
    return { success: false, error: 'Playlist no encontrada' }
  }

  const cover = null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover = await getEffectiveCover(playlistData, cover)

  return {
    success: true,
    playlistData,
    cover,
    suggestedCovers,
    effectiveCover,
    coverConfig: buildCoverConfig(playlistData)
  }
}

export async function getPlaylistListPayload(filepath: string): Promise<PlaylistListPayload> {
  const baseDir = path.dirname(filepath)
  const playlistSongs = await processPlaylistTracks(filepath, baseDir)
  const processedData = stripPictures(playlistSongs)
  const playlistData = await getPlaylist(filepath)
  const cover = null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover: AudioCoverPayload | null = playlistData
    ? await getEffectiveCover(playlistData, cover)
    : cover

  const coverConfig = buildCoverConfig(playlistData)

  return {
    processedData,
    playlistData,
    cover,
    suggestedCovers,
    effectiveCover,
    coverConfig
  }
}
