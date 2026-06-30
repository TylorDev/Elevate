import { BrowserWindow } from 'electron'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  buildCollectionSummaryFromFileInfos,
  getFileInfos,
  processPlaylist
} from '../../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import { getStoragePaths } from '../../storagePaths.ts'
import { getCachedAudioFiles } from './audioLibrary.ts'
import {
  getDirectoryAudioFiles,
  getDirectoryByPath
} from './directories.ts'
import {
  FEED_RANKING_TABS,
  FEED_SCOPE_VALUES,
  getCollectionRecentActivity,
  getDirectoryChildrenCount,
  getDirectoryKind,
  getPathLeaf,
  isRootDirectoryRecord,
  normalizeFeedRankingsRequest,
  toNumber
} from './shared.ts'
import type { Playlist, PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioCoverPayload,
  AudioFileInfo,
  CollectionSummary,
  DecodedFeedCoverKey,
  DirectoryWithChildrenCount,
  FeedCollectionEntity,
  FeedCollectionRankingsResult,
  FeedCollectionType,
  FeedCoverRequest,
  FeedRankingPage,
  FeedRankings,
  FeedRankingsRequest,
  FeedRankingTab,
  FeedRankingTabId,
  FeedRefreshResult,
  FeedScope,
  FeedSnapshot,
  FeedSourceSignaturePlaylist
} from '../../Types/filehandlers.ts'

const db = prisma as unknown as PrismaClient
const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>
const FEED_CACHE_SCOPES: FeedScope[] = ['mixed', 'playlists', 'directories']
const FEED_CACHE_VERSION = 1
const FEED_ENTITY_BATCH_SIZE = 6
const feedRankingsCache = new Map<FeedScope, FeedSnapshot | null>()
const pendingFeedCollections = new Map<FeedScope, Promise<FeedSnapshot | null>>()
const feedCollectionCoverCache = new Map<string, AudioCoverPayload>()

for (const scope of FEED_CACHE_SCOPES) {
  feedRankingsCache.set(scope, null)
}

function getFeedCacheDir(): string {
  const cacheDir = getStoragePaths().feedCacheRoot
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.mkdirSync(path.join(cacheDir, 'covers'), { recursive: true })
  return cacheDir
}

function getFeedSnapshotPath(scope: FeedScope): string {
  return path.join(getFeedCacheDir(), `${scope}.json`)
}

function getFeedCoverCachePath(coverKey: string, coverSignature = ''): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${coverKey}|${coverSignature}`)
    .digest('hex')
  return path.join(getFeedCacheDir(), 'covers', `${hash}.png`)
}

function encodeFeedCoverKey(type: FeedCollectionType, sourcePath = ''): string {
  return `${type}:${Buffer.from(sourcePath).toString('base64url')}`
}

function decodeFeedCoverKey(coverKey = ''): DecodedFeedCoverKey | null {
  const separatorIndex = coverKey.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  const type = coverKey.slice(0, separatorIndex)
  const encodedPath = coverKey.slice(separatorIndex + 1)

  if (type !== 'playlist' && type !== 'directory') {
    return null
  }

  try {
    return {
      type,
      sourcePath: Buffer.from(encodedPath, 'base64url').toString('utf8')
    }
  } catch {
    return null
  }
}

function delayFeedBatch(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function sendFeedRankingsUpdated(scope: FeedScope, generatedAt: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('feed:collection-rankings-updated', {
      scope,
      generatedAt
    })
  }
}

export function invalidateFeedCollectionsCache(scope: FeedScope | 'all' = 'all'): void {
  if (scope === 'all') {
    for (const cacheScope of FEED_CACHE_SCOPES) {
      feedRankingsCache.set(cacheScope, null)
      pendingFeedCollections.delete(cacheScope)
    }
    feedCollectionCoverCache.clear()
    return
  }

  if (!FEED_SCOPE_VALUES.has(scope)) return

  feedRankingsCache.set(scope, null)
  pendingFeedCollections.delete(scope)

  if (scope === 'playlists') {
    feedRankingsCache.set('mixed', null)
    pendingFeedCollections.delete('mixed')
  }

  if (scope === 'directories') {
    feedRankingsCache.set('mixed', null)
    pendingFeedCollections.delete('mixed')
  }
}

function getFileStatSignature(filePath = ''): string {
  if (!filePath) return 'missing'

  try {
    const stats = fs.statSync(filePath)
    return `${stats.mtimeMs}:${stats.size}`
  } catch {
    return 'missing'
  }
}

function getPlaylistFeedCoverSignature(playlist: Pick<Playlist, 'customCoverHash'> | null): string {
  return playlist?.customCoverHash || ''
}

function getDirectoryFeedCoverSignature(
  directory: DirectoryWithChildrenCount | null,
  trackCount = 0
): string {
  return [
    directory?.path || '',
    directory?.lastScannedAt?.getTime?.() || '',
    directory?.totalTracks || trackCount || 0,
    directory?.totalDuration || 0
  ].join('|')
}

function isFeedSnapshot(value: unknown, scope: FeedScope): value is FeedSnapshot {
  const snapshot = value as Partial<FeedSnapshot> | null
  return (
    snapshot?.version === FEED_CACHE_VERSION &&
    snapshot?.scope === scope &&
    snapshot?.status === 'ready' &&
    typeof snapshot?.generatedAt === 'string' &&
    typeof snapshot?.sourceSignature === 'string' &&
    Array.isArray(snapshot?.entities)
  )
}

async function readFeedSnapshot(scope: FeedScope): Promise<FeedSnapshot | null> {
  const memorySnapshot = feedRankingsCache.get(scope)
  if (memorySnapshot?.version === FEED_CACHE_VERSION) {
    return memorySnapshot
  }

  try {
    const snapshotText = await fs.promises.readFile(getFeedSnapshotPath(scope), 'utf8')
    const snapshot = JSON.parse(snapshotText) as unknown

    if (!isFeedSnapshot(snapshot, scope)) {
      return null
    }

    feedRankingsCache.set(scope, snapshot)
    return snapshot
  } catch {
    return null
  }
}

async function writeFeedSnapshot(scope: FeedScope, snapshot: FeedSnapshot): Promise<void> {
  const snapshotPath = getFeedSnapshotPath(scope)
  const tempPath = `${snapshotPath}.tmp`
  await fs.promises.writeFile(tempPath, JSON.stringify(snapshot), 'utf8')
  await fs.promises.rename(tempPath, snapshotPath)
  feedRankingsCache.set(scope, snapshot)
}

async function getFeedSourceSignature(scope: FeedScope): Promise<string> {
  const shouldLoadPlaylists = scope === 'mixed' || scope === 'playlists'
  const shouldLoadDirectories = scope === 'mixed' || scope === 'directories'
  const signatureParts: unknown[] = []

  if (shouldLoadPlaylists) {
    const playlists = (await db.playlist.findMany({
      select: {
        id: true,
        path: true,
        duracion: true,
        numElementos: true,
        totalplays: true,
        customCoverMode: true,
        customCoverHash: true,
        customCoverValue: true,
        customCoverSelection: true,
        customCoverUpdatedAt: true
      },
      orderBy: {
        id: 'asc'
      }
    })) as FeedSourceSignaturePlaylist[]
    signatureParts.push({
      playlists: playlists.map((playlist) => ({
        ...playlist,
        stat: getFileStatSignature(playlist.path),
        customCoverUpdatedAt: playlist.customCoverUpdatedAt?.toISOString?.() || null
      }))
    })
  }

  if (shouldLoadDirectories) {
    const directories = (await db.directory.findMany({
      select: {
        id: true,
        path: true,
        parentId: true,
        totalTracks: true,
        totalDuration: true,
        lastScannedAt: true,
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    })) as DirectoryWithChildrenCount[]
    signatureParts.push({
      directories: directories.map((directory) => ({
        ...directory,
        childrenCount: getDirectoryChildrenCount(directory),
        directoryKind: getDirectoryKind(directory),
        lastScannedAt: directory.lastScannedAt?.toISOString?.() || null
      }))
    })
  }

  return crypto.createHash('sha1').update(JSON.stringify(signatureParts)).digest('hex')
}

async function mapFeedEntitiesInBatches<T>(
  items: T[],
  mapper: (item: T) => Promise<FeedCollectionEntity | null>
): Promise<FeedCollectionEntity[]> {
  const entities: FeedCollectionEntity[] = []

  for (let index = 0; index < items.length; index += FEED_ENTITY_BATCH_SIZE) {
    const batch = items.slice(index, index + FEED_ENTITY_BATCH_SIZE)
    const batchEntities = await Promise.all(batch.map((item) => mapper(item)))
    entities.push(...batchEntities.filter((entity): entity is FeedCollectionEntity => Boolean(entity)))
    await delayFeedBatch()
  }

  return entities
}

function buildCollectionEntityRankings(
  collections: FeedCollectionEntity[] = [],
  request: FeedRankingsRequest = {}
): FeedRankings {
  const { tabId, page, pageSize } = normalizeFeedRankingsRequest(request)
  const tabEntries: Array<[FeedRankingTabId, FeedRankingTab]> =
    tabId && FEED_RANKING_TABS[tabId]
      ? [[tabId, FEED_RANKING_TABS[tabId]]]
      : (Object.entries(FEED_RANKING_TABS) as Array<[FeedRankingTabId, FeedRankingTab]>)

  return tabEntries.reduce<FeedRankings>((rankings, [currentTabId, tab]) => {
    const sortedItems = collections
      .slice()
      .sort((left, right) => {
        const leftValue =
          tab.direction === 'date'
            ? new Date((left?.[tab.metricKey] as string | number | null) || 0).getTime()
            : toNumber(left?.[tab.metricKey])
        const rightValue =
          tab.direction === 'date'
            ? new Date((right?.[tab.metricKey] as string | number | null) || 0).getTime()
            : toNumber(right?.[tab.metricKey])

        if (rightValue !== leftValue) {
          return rightValue - leftValue
        }

        return String(left?.name || '').localeCompare(String(right?.name || ''), undefined, {
          sensitivity: 'base'
        })
      })
    const offset = (page - 1) * pageSize
    const items = sortedItems.slice(offset, offset + pageSize)

    rankings[currentTabId] = {
      items,
      page,
      pageSize,
      total: sortedItems.length,
      totalValue: sortedItems.reduce((total, item) => {
        if (tab.direction === 'date') {
          return total
        }

        return total + toNumber(item?.[tab.metricKey])
      }, 0),
      hasMore: offset + items.length < sortedItems.length
    } satisfies FeedRankingPage

    return rankings
  }, {})
}

function mapSummaryToCollectionEntity({
  type,
  id,
  name,
  sourcePath,
  tracks,
  summary,
  coverKey,
  coverSignature,
  recentActivityAt
}: {
  type: FeedCollectionType
  id: string
  name: string
  sourcePath: string
  tracks: AudioFileInfo[]
  summary: CollectionSummary
  coverKey: string
  coverSignature: string
  recentActivityAt: string | null
}): FeedCollectionEntity {
  return {
    id,
    type,
    name,
    path: sourcePath,
    coverKey,
    coverSignature,
    totalShortViews: toNumber(summary?.totalShortViews),
    totalLongViews: toNumber(summary?.totalLongViews),
    totalDuration: toNumber(summary?.totalDuration),
    totalAccumulatedDuration: toNumber(summary?.totalAccumulatedDuration),
    totalRepeats: toNumber(summary?.totalRepeats),
    totalSkips: toNumber(summary?.totalSkips),
    recentActivityAt,
    trackCount: toNumber(summary?.trackCount) || tracks.length
  }
}

async function buildDirectoryFeedEntity(
  directory: DirectoryWithChildrenCount
): Promise<FeedCollectionEntity | null> {
  if (isRootDirectoryRecord(directory)) {
    return null
  }

  const audioFiles = await getCachedAudioFiles(directory.path, { recursive: false })
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getAudioFileInfos(uniqueAudioFiles, { includePicture: false })
  const coverSignature = getDirectoryFeedCoverSignature(directory, uniqueAudioFiles.length)
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: directory.path
  }) as CollectionSummary

  return mapSummaryToCollectionEntity({
    type: 'directory',
    id: `directory:${directory.id}`,
    name: getPathLeaf(directory.path),
    sourcePath: directory.path,
    tracks,
    summary,
    coverKey: encodeFeedCoverKey('directory', directory.path),
    coverSignature,
    recentActivityAt: getCollectionRecentActivity(tracks)
  })
}

async function buildPlaylistFeedEntity(
  playlist: Playlist,
  lastOpenedAt: string | null = null
): Promise<FeedCollectionEntity> {
  const baseDir = path.dirname(playlist.path)
  const tracks = ((await processPlaylist(playlist.path, baseDir)) as AudioFileInfo[]).map((song) => ({
    ...song,
    picture: undefined
  }))
  const coverSignature = getPlaylistFeedCoverSignature(playlist)
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: playlist.path
  }) as CollectionSummary

  return mapSummaryToCollectionEntity({
    type: 'playlist',
    id: `playlist:${playlist.id}`,
    name: playlist.nombre || getPathLeaf(playlist.path),
    sourcePath: playlist.path,
    tracks,
    summary,
    coverKey: encodeFeedCoverKey('playlist', playlist.path),
    coverSignature,
    recentActivityAt: getCollectionRecentActivity(tracks, lastOpenedAt)
  })
}

async function getPlaylistHistoryDatesById(playlistIds: number[] = []): Promise<Map<number, string>> {
  if (!playlistIds.length) {
    return new Map()
  }

  const historyRecords = await db.historial.groupBy({
    by: ['playlistId'],
    where: {
      playlistId: {
        in: playlistIds
      }
    },
    _max: {
      playedAt: true
    }
  })

  return new Map(
    historyRecords
      .map((record) => {
        const playedAt = record._max?.playedAt
        return playedAt ? [record.playlistId, playedAt.toISOString()] : null
      })
      .filter((record): record is [number, string] => Boolean(record))
  )
}

async function buildFeedCollectionEntities(scope: FeedScope): Promise<FeedCollectionEntity[]> {
  const shouldLoadPlaylists = scope === 'mixed' || scope === 'playlists'
  const shouldLoadDirectories = scope === 'mixed' || scope === 'directories'
  const collections: FeedCollectionEntity[] = []

  if (shouldLoadPlaylists) {
    const playlists = (await db.playlist.findMany()) as Playlist[]
    const lastOpenedAtByPlaylistId = await getPlaylistHistoryDatesById(
      playlists.map((playlist) => playlist.id)
    )
    const playlistEntities = await mapFeedEntitiesInBatches(
      playlists,
      (playlist) =>
        buildPlaylistFeedEntity(playlist, lastOpenedAtByPlaylistId.get(playlist.id) || null)
    )
    collections.push(...playlistEntities)
  }

  if (shouldLoadDirectories) {
    const directories = (await db.directory.findMany({
      include: {
        _count: {
          select: {
            children: true
          }
        }
      }
    })) as DirectoryWithChildrenCount[]
    const normalDirectories = directories.filter((directory) => !isRootDirectoryRecord(directory))
    const directoryEntities = await mapFeedEntitiesInBatches(
      normalDirectories,
      buildDirectoryFeedEntity
    )
    collections.push(...directoryEntities)
  }

  return collections
}

async function buildAndStoreFeedSnapshot(scope: FeedScope): Promise<FeedSnapshot> {
  const sourceSignature = await getFeedSourceSignature(scope)
  const entities = await buildFeedCollectionEntities(scope)
  const snapshot: FeedSnapshot = {
    version: FEED_CACHE_VERSION,
    status: 'ready',
    scope,
    generatedAt: new Date().toISOString(),
    sourceSignature,
    entities
  }

  await writeFeedSnapshot(scope, snapshot)
  return snapshot
}

function startFeedRefreshJob(scope: FeedScope): {
  started: boolean
  alreadyRunning: boolean
  promise: Promise<FeedSnapshot | null>
} {
  const existingJob = pendingFeedCollections.get(scope)
  if (existingJob) {
    return {
      started: false,
      alreadyRunning: true,
      promise: existingJob
    }
  }

  invalidateFeedCollectionsCache(scope)
  const refreshJob = buildAndStoreFeedSnapshot(scope)
    .then((snapshot) => {
      sendFeedRankingsUpdated(scope, snapshot.generatedAt)
      return snapshot
    })
    .catch((error) => {
      console.error(`Error refreshing feed cache for ${scope}:`, error)
      return null
    })
    .finally(() => {
      pendingFeedCollections.delete(scope)
    })

  pendingFeedCollections.set(scope, refreshJob)

  return {
    started: true,
    alreadyRunning: false,
    promise: refreshJob
  }
}

export async function getFeedCollectionRankings(
  request: FeedRankingsRequest = {}
): Promise<FeedCollectionRankingsResult> {
  const normalizedRequest = normalizeFeedRankingsRequest(request)
  const currentSourceSignature = await getFeedSourceSignature(normalizedRequest.scope)
  const snapshot = await readFeedSnapshot(normalizedRequest.scope)

  if (normalizedRequest.forceRefresh) {
    startFeedRefreshJob(normalizedRequest.scope)
  }

  if (!snapshot) {
    startFeedRefreshJob(normalizedRequest.scope)
    return {
      success: true,
      scope: normalizedRequest.scope,
      total: 0,
      cached: false,
      stale: false,
      cacheMiss: true,
      refreshing: true,
      generatedAt: null,
      rankings: buildCollectionEntityRankings([], normalizedRequest)
    }
  }

  const isStale = snapshot.sourceSignature !== currentSourceSignature
  if (isStale || normalizedRequest.forceRefresh) {
    startFeedRefreshJob(normalizedRequest.scope)
  }

  const entities = Array.isArray(snapshot.entities) ? snapshot.entities : []

  return {
    success: true,
    scope: normalizedRequest.scope,
    total: entities.length,
    cached: true,
    stale: isStale,
    cacheMiss: false,
    refreshing: pendingFeedCollections.has(normalizedRequest.scope),
    generatedAt: snapshot.generatedAt,
    rankings: buildCollectionEntityRankings(entities, normalizedRequest)
  }
}

export async function refreshFeedCollectionRankings(
  request: FeedRankingsRequest = {}
): Promise<FeedRefreshResult> {
  const normalizedRequest = normalizeFeedRankingsRequest(request)
  const jobResult = startFeedRefreshJob(normalizedRequest.scope)

  return {
    success: true,
    scope: normalizedRequest.scope,
    started: jobResult.started,
    alreadyRunning: jobResult.alreadyRunning
  }
}

export async function getFeedCollectionCover(
  request: FeedCoverRequest = {}
): Promise<AudioCoverPayload | null> {
  const coverKey = typeof request?.coverKey === 'string' ? request.coverKey : ''
  const coverSignature = typeof request?.coverSignature === 'string' ? request.coverSignature : ''
  const decodedCoverKey = decodeFeedCoverKey(coverKey)

  if (!decodedCoverKey?.sourcePath) {
    return null
  }

  const memoryCover = feedCollectionCoverCache.get(`${coverKey}:${coverSignature}`)
  if (memoryCover) {
    return memoryCover
  }

  const coverPath = getFeedCoverCachePath(coverKey, coverSignature)
  try {
    const cachedBuffer = await fs.promises.readFile(coverPath)
    const cachedCover: AudioCoverPayload = {
      data: cachedBuffer,
      mimeType: 'image/png'
    }
    feedCollectionCoverCache.set(`${coverKey}:${coverSignature}`, cachedCover)
    return cachedCover
  } catch {
    // Missing cover cache; generate lazily below.
  }

  const { type, sourcePath } = decodedCoverKey
  let tracks: AudioFileInfo[]

  if (type === 'playlist') {
    return null
  } else {
    const directory = await getDirectoryByPath(sourcePath)
    const audioFiles = directory
      ? await getDirectoryAudioFiles(directory)
      : await getCachedAudioFiles(sourcePath, { recursive: false })

    tracks = await getAudioFileInfos(Array.from(new Set(audioFiles)), {
      includePicture: false
    })
  }
  const coverBuffer = (await generateCollectionCoverFromTracks(tracks)) as Buffer | null

  if (!coverBuffer) {
    return null
  }

  await fs.promises.writeFile(coverPath, coverBuffer)
  const generatedCover: AudioCoverPayload = {
    data: coverBuffer,
    mimeType: 'image/png'
  }
  feedCollectionCoverCache.set(`${coverKey}:${coverSignature}`, generatedCover)
  return generatedCover
}
