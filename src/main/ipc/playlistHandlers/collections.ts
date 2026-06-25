// @ts-nocheck
import path from 'path'
import { buildCollectionSummaryFromFileInfos, processPlaylist } from '../utils/utils.ts'
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

export async function getPlaylistOverview(filepath, request = {}) {
  const baseDir = path.dirname(filepath)
  const tracks = (await processPlaylist(filepath, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
  const playlistData = await getPlaylist(filepath)
  const effectiveCover = playlistData?.customCoverHash || playlistData?.customCoverMode
    ? await getEffectiveCover(playlistData, false)
    : null
  const resolvedCover = effectiveCover
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
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

export async function getPlaylistTracksPage(filepath, request = {}) {
  const { page, pageSize } = normalizePageRequest(request)
  const baseDir = path.dirname(filepath)
  const tracks = (await processPlaylist(filepath, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
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

export async function getPlaylistEditPayload(filepath) {
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

export async function getPlaylistListPayload(filepath) {
  const baseDir = path.dirname(filepath)
  const playlistSongs = await processPlaylist(filepath, baseDir)
  const processedData = playlistSongs.map((song) => ({ ...song, picture: undefined }))
  const playlistData = await getPlaylist(filepath)
  const cover = null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover = playlistData ? await getEffectiveCover(playlistData, cover) : cover

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
