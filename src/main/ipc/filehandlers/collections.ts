import { buildCollectionSummaryFromFileInfos, getFileInfos } from '../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../utils/collectionDetail.ts'
import { getLikesOverview, getLikesTracksPage } from '../likehandlers/index.ts'
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
import type {
  AudioFileInfo,
  CollectionOverviewResult,
  CollectionRequest,
  CollectionSummary,
  CollectionTracksPageResult,
  DirectoryCollectionOverviewSuccess,
  PageResult
} from '../../Types/filehandlers.ts'

const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>

async function getDirectoryOverview(
  directoryPath: string,
  request: CollectionRequest = {}
): Promise<DirectoryCollectionOverviewSuccess | CollectionOverviewResult> {
  const directory = await getDirectoryByPath(directoryPath)

  if (!directory) {
    return { success: false, error: 'Directory not found' }
  }

  const directoryData = await enrichDirectory(directory)
  if (!directoryData) {
    return { success: false, error: 'Directory not found' }
  }

  const audioFiles = await getDirectoryAudioFiles(directoryData)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getAudioFileInfos(uniqueAudioFiles, { includePicture: false })
  const cover = (await generateCollectionCoverFromTracks(tracks)) as Buffer | null
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: directoryPath,
    cover
  }) as CollectionSummary

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

async function getDirectoryTracksPage(
  directoryPath: string,
  request: CollectionRequest = {}
): Promise<PageResult<AudioFileInfo>> {
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
  const items = await getAudioFileInfos(pagedPaths, { includePicture: false })

  return {
    items,
    page,
    pageSize,
    total: uniqueAudioFiles.length,
    hasMore: offset + items.length < uniqueAudioFiles.length
  }
}

export async function getCollectionOverview(
  request: CollectionRequest = {}
): Promise<CollectionOverviewResult> {
  const type = request?.type
  const sourcePath = request?.sourcePath || ''

  if (type === 'likes') {
    return getLikesOverview(request) as Promise<CollectionOverviewResult>
  }

  if (!sourcePath) {
    return { success: false, error: 'sourcePath is required' }
  }

  if (type === 'playlist') {
    return getPlaylistOverview(sourcePath, request) as Promise<CollectionOverviewResult>
  }

  if (type === 'directory') {
    return getDirectoryOverview(sourcePath, request)
  }

  return { success: false, error: 'Invalid collection type' }
}

export async function getCollectionTracksPage(
  request: CollectionRequest = {}
): Promise<CollectionTracksPageResult> {
  const type = request?.type
  const sourcePath = request?.sourcePath || ''

  if (type === 'likes') {
    return getLikesTracksPage(request) as Promise<CollectionTracksPageResult>
  }

  if (!sourcePath) {
    return { success: false, error: 'sourcePath is required' }
  }

  if (type === 'playlist') {
    return getPlaylistTracksPage(sourcePath, request) as Promise<CollectionTracksPageResult>
  }

  if (type === 'directory') {
    return getDirectoryTracksPage(sourcePath, request)
  }

  return { success: false, error: 'Invalid collection type' }
}
