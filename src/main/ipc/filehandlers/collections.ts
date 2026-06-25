// @ts-nocheck
import { buildCollectionSummaryFromFileInfos, getFileInfos } from '../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../utils/collectionDetail.ts'
import { getLikesOverview, getLikesTracksPage } from '../likehandlers.ts'
import {
  getPlaylistOverview,
  getPlaylistTracksPage
} from '../playlistHandlers/index.ts'
import {
  buildInsightRankingsFromTracks,
  getPathLeaf,
  normalizeCollectionPageRequest
} from './shared.ts'
import {
  enrichDirectory,
  getDirectoryAudioFiles,
  getDirectoryByPath
} from './directories.ts'

async function getDirectoryOverview(directoryPath, request = {}) {
  const directory = await getDirectoryByPath(directoryPath)

  if (!directory) {
    return { success: false, error: 'Directory not found' }
  }

  const directoryData = await enrichDirectory(directory)
  const audioFiles = await getDirectoryAudioFiles(directoryData)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getFileInfos(uniqueAudioFiles, { includePicture: false })
  const cover = await generateCollectionCoverFromTracks(tracks)
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: directoryPath,
    cover
  })

  return {
    success: true,
    type: 'directory',
    meta: {
      title: getPathLeaf(directory.path),
      sourcePath: directory.path,
      createdAt: directory.createdAt || null,
      lastScannedAt: directory.lastScannedAt || null,
      editable: false,
      directoryKind: directoryData.directoryKind,
      recursiveTotalTracks: directoryData.recursiveTotalTracks,
      recursiveTotalDuration: directoryData.recursiveTotalDuration,
      directoryData
    },
    summary,
    rankings: buildInsightRankingsFromTracks(tracks, request)
  }
}

async function getDirectoryTracksPage(directoryPath, request = {}) {
  const { page, pageSize } = normalizeCollectionPageRequest(request)
  const directory = await getDirectoryByPath(directoryPath)

  if (!directory) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const directoryData = await enrichDirectory(directory)
  const audioFiles = await getDirectoryAudioFiles(directoryData)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const offset = (page - 1) * pageSize
  const pagedPaths = uniqueAudioFiles.slice(offset, offset + pageSize)
  const items = await getFileInfos(pagedPaths, { includePicture: false })

  return {
    items,
    page,
    pageSize,
    total: uniqueAudioFiles.length,
    hasMore: offset + items.length < uniqueAudioFiles.length
  }
}

export async function getCollectionOverview(request = {}) {
  const type = request?.type
  const sourcePath = request?.sourcePath || ''

  if (type === 'likes') {
    return getLikesOverview(request)
  }

  if (!sourcePath) {
    return { success: false, error: 'sourcePath is required' }
  }

  if (type === 'playlist') {
    return getPlaylistOverview(sourcePath, request)
  }

  if (type === 'directory') {
    return getDirectoryOverview(sourcePath, request)
  }

  return { success: false, error: 'Invalid collection type' }
}

export async function getCollectionTracksPage(request = {}) {
  const type = request?.type
  const sourcePath = request?.sourcePath || ''

  if (type === 'likes') {
    return getLikesTracksPage(request)
  }

  if (!sourcePath) {
    return { success: false, error: 'sourcePath is required' }
  }

  if (type === 'playlist') {
    return getPlaylistTracksPage(sourcePath, request)
  }

  if (type === 'directory') {
    return getDirectoryTracksPage(sourcePath, request)
  }

  return { success: false, error: 'Invalid collection type' }
}
