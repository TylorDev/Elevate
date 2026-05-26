import { createRequire } from 'node:module'
import log from 'electron-log/main.js'
import {
  extractAudioCover,
  buildCollectionSummaryFromFileInfos,
  buildRankingPageFromTracks,
  getFileInfos,
  processPlaylist,
  resizeCover,
  getCoverFromCache
} from './utils/utils.mjs'
import {
  buildCollectionSummary,
  generateCollectionCoverFromTracks
} from './utils/collectionDetail.mjs'

import {
  scanDirectoryAsync,
  indexDirectoryIncrementally,
  updateDirectoryStats
} from './utils/directoryScanner.mjs'

import {
  stopWatching,
  setNotifyRenderer
} from './utils/directoryWatcher.mjs'

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { sendNotification } from '../index.mjs'
import { prisma } from '../prisma.mjs'
import { setBraveVolume } from './audio.mjs'
import { addDirectoryToLibrary } from './utils/libraryIngestion.mjs'
import {
  getPlaylistEditPayload,
  getPlaylistOverview,
  getPlaylistTracksPage
} from './playlistHandlers.mjs'
import { getLikesOverview, getLikesTracksPage } from './likehandlers.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, BrowserWindow, dialog, ipcMain, shell } = electron
const audioPathsCache = new Map()
const audioCoverCache = new Map()
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400
const FEED_CACHE_SCOPES = ['mixed', 'playlists', 'directories']
const FEED_CACHE_VERSION = 1
const FEED_ENTITY_BATCH_SIZE = 6
let pendingDirectoriesRequest = null
const INSIGHT_METRIC_KEYS = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}
const FEED_SCOPE_VALUES = new Set(['mixed', 'playlists', 'directories'])
const feedRankingsCache = new Map()
const pendingFeedCollections = new Map()
const feedCollectionCoverCache = new Map()
const FEED_RANKING_TABS = {
  recent: {
    metricKey: 'recentActivityAt',
    direction: 'date'
  },
  shortViews: {
    metricKey: 'totalShortViews',
    direction: 'number'
  },
  longViews: {
    metricKey: 'totalLongViews',
    direction: 'number'
  },
  duration: {
    metricKey: 'totalDuration',
    direction: 'number'
  },
  accumulatedDuration: {
    metricKey: 'totalAccumulatedDuration',
    direction: 'number'
  },
  repeats: {
    metricKey: 'totalRepeats',
    direction: 'number'
  },
  skips: {
    metricKey: 'totalSkips',
    direction: 'number'
  }
}

for (const scope of FEED_CACHE_SCOPES) {
  feedRankingsCache.set(scope, null)
}

function getFeedCacheDir() {
  const baseDir = app.getPath('userData')
  const cacheDir = path.join(baseDir, 'feed-cache-v1')
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.mkdirSync(path.join(cacheDir, 'covers'), { recursive: true })
  return cacheDir
}

function getFeedSnapshotPath(scope) {
  return path.join(getFeedCacheDir(), `${scope}.json`)
}

function getFeedCoverCachePath(coverKey, coverSignature = '') {
  const hash = crypto
    .createHash('sha1')
    .update(`${coverKey}|${coverSignature}`)
    .digest('hex')
  return path.join(getFeedCacheDir(), 'covers', `${hash}.png`)
}

function encodeFeedCoverKey(type, sourcePath = '') {
  return `${type}:${Buffer.from(sourcePath).toString('base64url')}`
}

function decodeFeedCoverKey(coverKey = '') {
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

function delayFeedBatch() {
  return new Promise((resolve) => setImmediate(resolve))
}

function sendFeedRankingsUpdated(scope, generatedAt) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('feed:collection-rankings-updated', {
      scope,
      generatedAt
    })
  }
}

function buildInsightRankingsFromTracks(tracks = [], request = {}) {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce((rankings, [tabId, metricKey]) => {
    rankings[tabId] = buildRankingPageFromTracks(tracks, metricKey, { page, pageSize })
    return rankings
  }, {})
}

function normalizeCollectionPageRequest(request = {}) {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function invalidateDirectoryCache(dirPath = null) {
  pendingDirectoriesRequest = null
  invalidateFeedCollectionsCache('all')

  if (!dirPath) {
    audioPathsCache.clear()
    audioCoverCache.clear()
    return
  }

  for (const key of audioPathsCache.keys()) {
    if (key === dirPath || key.endsWith(`:${dirPath}`) || key.includes(dirPath)) {
      audioPathsCache.delete(key)
    }
  }

  for (const key of audioCoverCache.keys()) {
    if (key.startsWith(`${dirPath}:`) || key.includes(`:${dirPath}:`)) {
      audioCoverCache.delete(key)
    }
  }
}

function getAudioPathsCacheKey(dirPath, recursive = true) {
  return `${recursive ? 'recursive' : 'direct'}:${dirPath}`
}

async function getCachedAudioFiles(dirPath, { recursive = true } = {}) {
  const cacheKey = getAudioPathsCacheKey(dirPath, recursive)
  const cachedFiles = audioPathsCache.get(cacheKey)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  const files = await scanDirectoryAsync(dirPath, recursive)
  audioPathsCache.set(cacheKey, {
    files,
    expiresAt: Date.now() + AUDIO_PATHS_TTL
  })

  return files
}

async function getUniqueAudioPaths() {
  const directories = await prisma.directory.findMany()

  if (!directories.length) return []

  const allAudioFiles = []
  for (const dir of directories) {
    const files = await getCachedAudioFiles(dir.path, { recursive: true })
    allAudioFiles.push(...files)
  }
  return [...new Set(allAudioFiles)]
}

function normalizeAudioPageRequest(request = {}) {
  if (typeof request === 'number') {
    return {
      page: Math.max(request, 1),
      pageSize: 100
    }
  }

  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 100, 1), 250)
  }
}

function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

function getPathLeaf(pathValue = '') {
  const normalizedPath = String(pathValue).replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || normalizedPath
}

function getRandomIndex(total) {
  return Math.floor(Math.random() * total)
}

function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function getDirectoryChildrenCount(directory) {
  return toNumber(directory?._count?.children ?? directory?.childrenCount)
}

function getDirectoryKind(directory) {
  return toNumber(directory?.totalTracks) === 0 && getDirectoryChildrenCount(directory) > 0
    ? 'root'
    : 'normal'
}

function isRootDirectoryRecord(directory) {
  return getDirectoryKind(directory) === 'root'
}

async function getDirectoryRecursiveStats(directoryPath) {
  const audioFiles = Array.from(
    new Set(await getCachedAudioFiles(directoryPath, { recursive: true }))
  )

  if (audioFiles.length === 0) {
    return {
      recursiveTotalTracks: 0,
      recursiveTotalDuration: 0
    }
  }

  const songs = await prisma.songs.findMany({
    where: {
      filepath: {
        in: audioFiles
      }
    },
    select: {
      duration: true
    }
  })

  return {
    recursiveTotalTracks: audioFiles.length,
    recursiveTotalDuration: songs.reduce((total, song) => total + toNumber(song.duration), 0)
  }
}

async function enrichDirectory(directory) {
  if (!directory) {
    return null
  }

  const childrenCount = getDirectoryChildrenCount(directory)
  const directoryKind = getDirectoryKind({
    ...directory,
    childrenCount
  })
  const directTotals = {
    recursiveTotalTracks: toNumber(directory.totalTracks),
    recursiveTotalDuration: toNumber(directory.totalDuration)
  }
  const recursiveTotals =
    directoryKind === 'root' ? await getDirectoryRecursiveStats(directory.path) : directTotals

  return {
    ...directory,
    childrenCount,
    directoryKind,
    ...recursiveTotals
  }
}

async function enrichDirectories(directories = []) {
  return Promise.all(directories.map((directory) => enrichDirectory(directory)))
}

async function getDirectoryByPath(directoryPath) {
  return prisma.directory.findUnique({
    where: { path: directoryPath },
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  })
}

async function getDirectoryBranch(directoryId) {
  const directories = await prisma.directory.findMany({
    select: {
      id: true,
      path: true,
      parentId: true
    }
  })
  const childrenByParentId = new Map()

  for (const directory of directories) {
    const currentChildren = childrenByParentId.get(directory.parentId) || []
    currentChildren.push(directory)
    childrenByParentId.set(directory.parentId, currentChildren)
  }

  const branch = []
  const stack = [...(childrenByParentId.get(directoryId) || [])]

  while (stack.length > 0) {
    const directory = stack.pop()
    branch.push(directory)
    stack.push(...(childrenByParentId.get(directory.id) || []))
  }

  return branch
}

async function getDirectoryAudioFiles(directory) {
  const enrichedDirectory = directory?.directoryKind ? directory : await enrichDirectory(directory)

  if (!enrichedDirectory?.path) {
    return []
  }

  const recursive = enrichedDirectory?.directoryKind === 'root'

  return getCachedAudioFiles(enrichedDirectory.path, { recursive })
}

function getLatestIsoDate(values = []) {
  const latestTimestamp = values.reduce((latest, value) => {
    if (!value) {
      return latest
    }

    const timestamp = new Date(value).getTime()

    if (!Number.isFinite(timestamp)) {
      return latest
    }

    return Math.max(latest, timestamp)
  }, 0)

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null
}

function getCollectionRecentActivity(tracks = [], extraDate = null) {
  return getLatestIsoDate([
    extraDate,
    ...tracks.map((track) => track?.lastPlayedAt).filter(Boolean)
  ])
}

function normalizeFeedRankingsRequest(request = {}) {
  const scope = FEED_SCOPE_VALUES.has(request?.scope) ? request.scope : 'mixed'

  return {
    scope,
    tabId: typeof request?.tabId === 'string' ? request.tabId : '',
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 30, 1), 100),
    forceRefresh: Boolean(request?.forceRefresh)
  }
}

function invalidateFeedCollectionsCache(scope = 'all') {
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

function getFileStatSignature(filePath = '') {
  if (!filePath) return 'missing'

  try {
    const stats = fs.statSync(filePath)
    return `${stats.mtimeMs}:${stats.size}`
  } catch {
    return 'missing'
  }
}

function getPlaylistFeedCoverSignature(playlist) {
  return playlist?.customCoverHash || ''
}

function getDirectoryFeedCoverSignature(directory, trackCount = 0) {
  return [
    directory?.path || '',
    directory?.lastScannedAt?.getTime?.() || '',
    directory?.totalTracks || trackCount || 0,
    directory?.totalDuration || 0
  ].join('|')
}

async function getCachedFeedCollectionCover({ type, sourcePath, signature, tracks }) {
  const cacheKey = `${type}:${sourcePath}`
  const cachedCover = feedCollectionCoverCache.get(cacheKey)

  if (cachedCover?.signature === signature) {
    return cachedCover.cover
  }

  const cover = await generateCollectionCoverFromTracks(tracks)
  feedCollectionCoverCache.set(cacheKey, {
    signature,
    cover
  })
  return cover
}

async function readFeedSnapshot(scope) {
  const memorySnapshot = feedRankingsCache.get(scope)
  if (memorySnapshot?.version === FEED_CACHE_VERSION) {
    return memorySnapshot
  }

  try {
    const snapshotText = await fs.promises.readFile(getFeedSnapshotPath(scope), 'utf8')
    const snapshot = JSON.parse(snapshotText)

    if (snapshot?.version !== FEED_CACHE_VERSION || snapshot?.scope !== scope) {
      return null
    }

    feedRankingsCache.set(scope, snapshot)
    return snapshot
  } catch {
    return null
  }
}

async function writeFeedSnapshot(scope, snapshot) {
  const snapshotPath = getFeedSnapshotPath(scope)
  const tempPath = `${snapshotPath}.tmp`
  await fs.promises.writeFile(tempPath, JSON.stringify(snapshot), 'utf8')
  await fs.promises.rename(tempPath, snapshotPath)
  feedRankingsCache.set(scope, snapshot)
}

async function getFeedSourceSignature(scope) {
  const shouldLoadPlaylists = scope === 'mixed' || scope === 'playlists'
  const shouldLoadDirectories = scope === 'mixed' || scope === 'directories'
  const signatureParts = []

  if (shouldLoadPlaylists) {
    const playlists = await prisma.playlist.findMany({
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
    })
    signatureParts.push({
      playlists: playlists.map((playlist) => ({
        ...playlist,
        stat: getFileStatSignature(playlist.path),
        customCoverUpdatedAt: playlist.customCoverUpdatedAt?.toISOString?.() || null
      }))
    })
  }

  if (shouldLoadDirectories) {
    const directories = await prisma.directory.findMany({
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
    })
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

async function mapFeedEntitiesInBatches(items, mapper) {
  const entities = []

  for (let index = 0; index < items.length; index += FEED_ENTITY_BATCH_SIZE) {
    const batch = items.slice(index, index + FEED_ENTITY_BATCH_SIZE)
    const batchEntities = await Promise.all(batch.map((item) => mapper(item)))
    entities.push(...batchEntities.filter(Boolean))
    await delayFeedBatch()
  }

  return entities
}

function buildCollectionEntityRankings(collections = [], request = {}) {
  const { tabId, page, pageSize } = normalizeFeedRankingsRequest(request)
  const tabEntries = tabId && FEED_RANKING_TABS[tabId]
    ? [[tabId, FEED_RANKING_TABS[tabId]]]
    : Object.entries(FEED_RANKING_TABS)

  return tabEntries.reduce((rankings, [currentTabId, tab]) => {
    const sortedItems = collections
      .slice()
      .sort((left, right) => {
        const leftValue =
          tab.direction === 'date'
            ? new Date(left?.[tab.metricKey] || 0).getTime()
            : toNumber(left?.[tab.metricKey])
        const rightValue =
          tab.direction === 'date'
            ? new Date(right?.[tab.metricKey] || 0).getTime()
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
    }

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
}) {
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

async function buildDirectoryFeedEntity(directory) {
  if (isRootDirectoryRecord(directory)) {
    return null
  }

  const audioFiles = await getCachedAudioFiles(directory.path, { recursive: false })
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getFileInfos(uniqueAudioFiles, { includePicture: false })
  const coverSignature = getDirectoryFeedCoverSignature(directory, uniqueAudioFiles.length)
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: directory.path
  })

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

async function buildPlaylistFeedEntity(playlist, lastOpenedAt = null) {
  const baseDir = path.dirname(playlist.path)
  const tracks = (await processPlaylist(playlist.path, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
  const coverSignature = getPlaylistFeedCoverSignature(playlist)
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: playlist.path
  })

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

async function getPlaylistHistoryDatesById(playlistIds = []) {
  if (!playlistIds.length) {
    return new Map()
  }

  const historyRecords = await prisma.historial.groupBy({
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
      .filter(Boolean)
  )
}

async function buildFeedCollectionEntities(scope) {
  const shouldLoadPlaylists = scope === 'mixed' || scope === 'playlists'
  const shouldLoadDirectories = scope === 'mixed' || scope === 'directories'
  const collections = []

  if (shouldLoadPlaylists) {
    const playlists = await prisma.playlist.findMany()
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
    const directories = await prisma.directory.findMany({
      include: {
        _count: {
          select: {
            children: true
          }
        }
      }
    })
    const normalDirectories = directories.filter((directory) => !isRootDirectoryRecord(directory))
    const directoryEntities = await mapFeedEntitiesInBatches(
      normalDirectories,
      buildDirectoryFeedEntity
    )
    collections.push(...directoryEntities)
  }

  return collections
}

async function buildAndStoreFeedSnapshot(scope) {
  const sourceSignature = await getFeedSourceSignature(scope)
  const entities = await buildFeedCollectionEntities(scope)
  const snapshot = {
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

function startFeedRefreshJob(scope) {
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

async function getFeedCollectionRankings(request = {}) {
  const normalizedRequest = normalizeFeedRankingsRequest(request)
  const currentSourceSignature = await getFeedSourceSignature(normalizedRequest.scope)
  let snapshot = await readFeedSnapshot(normalizedRequest.scope)

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

async function refreshFeedCollectionRankings(request = {}) {
  const normalizedRequest = normalizeFeedRankingsRequest(request)
  const jobResult = startFeedRefreshJob(normalizedRequest.scope)

  return {
    success: true,
    scope: normalizedRequest.scope,
    started: jobResult.started,
    alreadyRunning: jobResult.alreadyRunning
  }
}

async function getFeedCollectionCover(request = {}) {
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
    const cachedCover = {
      data: cachedBuffer,
      mimeType: 'image/png'
    }
    feedCollectionCoverCache.set(`${coverKey}:${coverSignature}`, cachedCover)
    return cachedCover
  } catch {
    // Missing cover cache; generate lazily below.
  }

  const { type, sourcePath } = decodedCoverKey
  let tracks

  if (type === 'playlist') {
    return null
  } else {
    const directory = await getDirectoryByPath(sourcePath)
    const audioFiles = directory
      ? await getDirectoryAudioFiles(directory)
      : await getCachedAudioFiles(sourcePath, { recursive: false })

    tracks = await getFileInfos(Array.from(new Set(audioFiles)), {
      includePicture: false
    })
  }
  const coverBuffer = await generateCollectionCoverFromTracks(tracks)

  if (!coverBuffer) {
    return null
  }

  await fs.promises.writeFile(coverPath, coverBuffer)
  const generatedCover = {
    data: coverBuffer,
    mimeType: 'image/png'
  }
  feedCollectionCoverCache.set(`${coverKey}:${coverSignature}`, generatedCover)
  return generatedCover
}

async function getDirectoryDetail(directoryPath) {
  const directory = await getDirectoryByPath(directoryPath)

  if (!directory) {
    return { success: false, error: 'Directory not found' }
  }

  const directoryData = await enrichDirectory(directory)
  const audioFiles = await getDirectoryAudioFiles(directoryData)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getFileInfos(uniqueAudioFiles, { includePicture: false })
  const cover = await generateCollectionCoverFromTracks(tracks)
  const summary = buildCollectionSummary(tracks, {
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
    tracks,
    summary
  }
}

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

async function getCollectionOverview(request = {}) {
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

async function getCollectionTracksPage(request = {}) {
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

async function getAudioFilesPage(request) {
  const { page, pageSize } = normalizeAudioPageRequest(request)
  const uniqueAudioFiles = await getUniqueAudioPaths()
  const start = (page - 1) * pageSize
  const paginatedAudioFiles = uniqueAudioFiles.slice(start, start + pageSize)
  const items = await getFileInfos(paginatedAudioFiles, { includePicture: false })

  return {
    items,
    page,
    pageSize,
    total: uniqueAudioFiles.length,
    hasMore: start + pageSize < uniqueAudioFiles.length
  }
}

async function getAudioCover(filePath, variant = 'thumb') {
  if (!filePath) return null

  const cacheKey = `${variant}:${filePath}`
  const cachedCover = audioCoverCache.get(cacheKey)

  if (cachedCover && cachedCover.expiresAt > Date.now()) {
    audioCoverCache.delete(cacheKey)
    audioCoverCache.set(cacheKey, cachedCover)
    return cachedCover.cover
  }

  // Try disk cache first (populated during indexing)
  const diskCover = await getCoverFromCache(filePath, variant)
  if (diskCover) {
    audioCoverCache.set(cacheKey, {
      cover: diskCover,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    while (audioCoverCache.size > COVER_CACHE_LIMIT) {
      const oldestKey = audioCoverCache.keys().next().value
      audioCoverCache.delete(oldestKey)
    }
    return diskCover
  }

  // Fallback: extract from file (should be rare after first indexing)
  const cover = await extractAudioCover(filePath)

  if (!cover) {
    audioCoverCache.set(cacheKey, {
      cover: null,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    return null
  }

  const result =
    variant === 'thumb'
      ? {
          data: await resizeCover(cover.buffer, 128),
          mimeType: 'image/jpeg'
        }
      : {
          data: cover.buffer,
          mimeType: cover.format
        }

  audioCoverCache.set(cacheKey, {
    cover: result,
    expiresAt: Date.now() + COVER_CACHE_TTL
  })

  while (audioCoverCache.size > COVER_CACHE_LIMIT) {
    const oldestKey = audioCoverCache.keys().next().value
    audioCoverCache.delete(oldestKey)
  }

  return result
}

async function searchDirectoriesPage(request = {}) {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 30, 1), 60)

  if (!query) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const matchingDirectories = await prisma.directory.findMany({
    where: {
      path: {
        contains: query
      }
    },
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  })

  const sortedDirectories = matchingDirectories
    .slice()
    .sort((left, right) =>
      getPathLeaf(left.path).localeCompare(getPathLeaf(right.path), undefined, {
        sensitivity: 'base'
      })
    )

  const start = (page - 1) * pageSize
  const pagedDirectories = await enrichDirectories(sortedDirectories.slice(start, start + pageSize))
  const items = pagedDirectories.map((directory) => {
    const visibleTracks =
      directory.directoryKind === 'root'
        ? directory.recursiveTotalTracks
        : directory.totalTracks
    const visibleDuration =
      directory.directoryKind === 'root'
        ? directory.recursiveTotalDuration
        : directory.totalDuration

    return {
    type: 'directory',
    id: directory.id,
    title: getPathLeaf(directory.path),
    subtitle:
      directory.directoryKind === 'root'
        ? `Root - ${visibleTracks ?? 0} tracks`
        : `${visibleTracks ?? 0} tracks`,
    meta: directory.path,
    actionPayload: {
      path: directory.path
    },
    path: directory.path,
    totalTracks: directory.totalTracks,
    totalDuration: directory.totalDuration,
    recursiveTotalTracks: directory.recursiveTotalTracks,
    recursiveTotalDuration: directory.recursiveTotalDuration,
    visibleTracks,
    visibleDuration,
    directoryKind: directory.directoryKind
    }
  })

  return {
    items,
    page,
    pageSize,
    total: sortedDirectories.length,
    hasMore: start + items.length < sortedDirectories.length
  }
}

async function getRandomDirectory() {
  try {
    const directories = await prisma.directory.findMany({
      include: {
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    })
    const normalDirectories = directories.filter((directory) => !isRootDirectoryRecord(directory))

    if (normalDirectories.length === 0) return null

    const randomIndex = getRandomIndex(normalDirectories.length)

    return enrichDirectory(normalDirectories[randomIndex])
  } catch (error) {
    console.error('Error fetching random directory:', error)
    return null
  }
}

export function setupFilehandlers() {
  // Connect the watcher notification system to the renderer
  setNotifyRenderer((message) => sendNotification(message))

  // Signal file watcher (for Brave volume control)
  const signalFilePath =
    process.env.ELEVATE_SIGNAL_FILE || path.join(app.getPath('userData'), 'signal.txt')
  if (fs.existsSync(signalFilePath)) {
    log.info('File exists, starting watch:', signalFilePath)

    fs.watch(signalFilePath, (eventType, filename) => {
      if (filename) {
        fs.readFile(signalFilePath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error al leer el archivo: ${err}`)
            return
          }

          if (data.startsWith('\ufeff')) {
            data = data.slice(1)
          }

          if (data) {
            setBraveVolume(0.2)
          } else {
            setBraveVolume(1)
          }
        })
      }
    })

    log.info('Vigilando el txt:', signalFilePath)
  } else {
    log.info('Signal file not found, skipping optional watcher:', signalFilePath)
  }

  // ─── add-directory ───────────────────────────────────────────────
  // Opens native dialog, discovers sub-directories with audio,
  // registers them in DB, and kicks off background indexing.
  ipcMain.handle('add-directory', async (_, providedPath = null) => {
    try {
      let selectedPath = providedPath

      if (!selectedPath) {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory']
        })

        if (result.canceled) {
          return null
        }

        selectedPath = result.filePaths[0]
      }

      return await addDirectoryToLibrary(selectedPath, {
        notifyRenderer: sendNotification,
        invalidateDirectoryCache
      })
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('get-new-audio-files', async () => {
    try {
      // Obtener las últimas 5 canciones de la base de datos, ordenadas por timestamp
      const recentAudioFiles = await prisma.songs.findMany({
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          filepath: true
        },
        take: 5
      })

      const filepathsArray = recentAudioFiles.map((song) => song.filepath)
      return getFileInfos(filepathsArray, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving latest audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files', async (event, currentPage) => {
    try {
      if (currentPage) {
        const pageResult = await getAudioFilesPage(currentPage)
        return pageResult.items
      }

      const uniqueAudioFiles = await getUniqueAudioPaths()

      return getFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files-page', async (event, request) => {
    try {
      return await getAudioFilesPage(request)
    } catch (error) {
      console.error('Error retrieving paginated audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-cover-thumbnail', async (event, filePath) => {
    try {
      return await getAudioCover(filePath, 'thumb')
    } catch (error) {
      console.error('Error retrieving audio cover thumbnail:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-cover-full', async (event, filePath) => {
    try {
      return await getAudioCover(filePath, 'full')
    } catch (error) {
      console.error('Error retrieving full audio cover:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files-number', async () => {
    try {
      const uniqueAudioFiles = await getUniqueAudioPaths()

      return uniqueAudioFiles.length
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('get-audio-in-directory', async (_, directoryPath) => {
    try {
      const directory = await getDirectoryByPath(directoryPath)

      if (!directory) {
        return [] // El directorio no existe en la base de datos, devolver un array vacío
      }

      // Obtener todos los archivos de audio del directorio específico
      const directoryData = await enrichDirectory(directory)
      const audioFiles = await getDirectoryAudioFiles(directoryData)

      // Filtrar archivos duplicados
      const uniqueAudioFiles = Array.from(new Set(audioFiles))

      return getFileInfos(uniqueAudioFiles, { includePicture: false })
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
      throw error
    }
  })

  ipcMain.handle('get-directory-detail', async (_, directoryPath) => {
    try {
      return await getDirectoryDetail(directoryPath)
    } catch (error) {
      console.error('Error retrieving directory detail:', error)
      return { success: false, error: error.message || 'Could not load the directory.' }
    }
  })

  ipcMain.handle('collection:get-overview', async (_, request) => {
    try {
      return await getCollectionOverview(request)
    } catch (error) {
      console.error('Error retrieving collection overview:', error)
      return { success: false, error: error.message || 'Could not load the collection.' }
    }
  })

  ipcMain.handle('collection:get-tracks-page', async (_, request) => {
    try {
      return await getCollectionTracksPage(request)
    } catch (error) {
      console.error('Error retrieving collection tracks page:', error)
      return { success: false, error: error.message || 'Could not load songs.' }
    }
  })

  ipcMain.handle('collection:get-playlist-edit-payload', async (_, playlistPath) => {
    try {
      return await getPlaylistEditPayload(playlistPath)
    } catch (error) {
      console.error('Error retrieving playlist edit payload:', error)
      return { success: false, error: error.message || 'No se pudo cargar la playlist.' }
    }
  })

  ipcMain.handle('feed:get-collection-rankings', async (_, request) => {
    try {
      return await getFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error retrieving feed collection rankings:', error)
      return { success: false, error: error.message || 'No se pudo cargar el feed.' }
    }
  })

  ipcMain.handle('feed:refresh-collection-rankings', async (_, request) => {
    try {
      return await refreshFeedCollectionRankings(request)
    } catch (error) {
      console.error('Error refreshing feed collection rankings:', error)
      return { success: false, error: error.message || 'No se pudo actualizar el feed.' }
    }
  })

  ipcMain.handle('feed:get-collection-cover', async (_, request) => {
    try {
      return await getFeedCollectionCover(request)
    } catch (error) {
      console.error('Error retrieving feed collection cover:', error)
      return null
    }
  })

  // ─── delete-directory ────────────────────────────────────────────
  ipcMain.handle('delete-directory', async (event, dirPath) => {
    try {
      const directory = await getDirectoryByPath(dirPath)

      if (!directory) {
        return { success: false, message: 'Directory not found.' }
      }

      if (getDirectoryChildrenCount(directory) > 0) {
        return {
          success: false,
          message: 'Directories with imported children must be removed as a branch.'
        }
      }

      // Stop watching this directory
      await stopWatching(dirPath)

      // Delete the directory (cascade deletes children via Prisma relation)
      await prisma.directory.delete({
        where: { path: dirPath }
      })
      invalidateDirectoryCache(dirPath)
      return { success: true, message: 'Directory deleted successfully.' }
    } catch (error) {
      console.error('Error deleting directory:', error)
      return { success: false, message: 'Error deleting directory.' }
    }
  })

  ipcMain.handle('delete-directory-branch', async (event, request) => {
    try {
      const dirPath = typeof request === 'string' ? request : request?.path

      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, message: 'Directory path is required.' }
      }

      const directory = await getDirectoryByPath(dirPath)

      if (!directory) {
        return { success: false, message: 'Directory not found.' }
      }

      const descendants = await getDirectoryBranch(directory.id)
      const deletedPaths = [directory.path, ...descendants.map((child) => child.path)]

      for (const currentPath of deletedPaths) {
        await stopWatching(currentPath).catch((error) => {
          console.error(`Error stopping watcher for ${currentPath}:`, error)
        })
      }

      await prisma.directory.delete({
        where: { path: dirPath }
      })

      invalidateDirectoryCache(dirPath)

      return {
        success: true,
        message: 'Directory branch removed successfully.',
        deletedDirectories: deletedPaths.length,
        deletedPaths
      }
    } catch (error) {
      console.error('Error deleting directory branch:', error)
      return { success: false, message: 'Error deleting directory branch.' }
    }
  })

  // ─── get-directory-by-path ───────────────────────────────────────
  // Now reads stats directly from the DB instead of recalculating.
  ipcMain.handle('get-directory-by-path', async (event, dirPath) => {
    try {
      const directory = await getDirectoryByPath(dirPath)

      if (!directory) {
        throw new Error('Directory not found')
      }

      // If never scanned, trigger a quick scan
      if (!directory.lastScannedAt) {
        const stats = await updateDirectoryStats(dirPath)
        return enrichDirectory({ ...directory, ...stats })
      }

      return enrichDirectory(directory)
    } catch (error) {
      console.error('Error retrieving directory:', error)
      throw error
    }
  })

  // ─── get-all-directories ─────────────────────────────────────────
  // Reads stats from DB. Only rescans directories that have never been scanned.
  ipcMain.handle('get-all-directories', async () => {
    try {
      if (pendingDirectoriesRequest) {
        return pendingDirectoriesRequest
      }

      pendingDirectoriesRequest = (async () => {
        const directories = await prisma.directory.findMany({
          include: {
            _count: {
              select: {
                children: true
              }
            }
          }
        })

        // For directories that have never been scanned, trigger an async scan sequentially
        const unscanned = directories.filter((d) => !d.lastScannedAt)
        if (unscanned.length > 0) {
          for (const dir of unscanned) {
            try {
              const stats = await updateDirectoryStats(dir.path)
              dir.totalTracks = stats.totalTracks
              dir.totalDuration = stats.totalDuration
            } catch (err) {
              console.error(`Error initial scan for ${dir.path}:`, err.message)
            }
          }
        }

        return enrichDirectories(directories)
      })().finally(() => {
        pendingDirectoriesRequest = null
      })

      return pendingDirectoriesRequest
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })

  ipcMain.handle('get-directories-number', async () => {
    try {
      const directories = await prisma.directory.findMany({
        include: {
          _count: {
            select: {
              children: true
            }
          }
        }
      })

      return directories.filter((directory) => !isRootDirectoryRecord(directory)).length
    } catch (error) {
      console.error('Error retrieving directories count:', error)
      throw error
    }
  })

  ipcMain.handle('get-random-directory', async () => {
    return await getRandomDirectory()
  })

  ipcMain.handle('search-directories-page', async (event, request) => {
    return searchDirectoriesPage(request)
  })

  ipcMain.handle('reveal-path-in-explorer', async (_, targetPath) => {
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        return { success: false, error: 'Path is required' }
      }

      shell.showItemInFolder(targetPath)
      return { success: true }
    } catch (error) {
      console.error('Error revealing path in explorer:', error)
      return { success: false, error: error.message || 'Could not open the explorer.' }
    }
  })

  ipcMain.handle('open-directory-in-explorer', async (_, targetPath) => {
    try {
      if (!targetPath || typeof targetPath !== 'string') {
        return { success: false, error: 'Path is required' }
      }

      const openError = await shell.openPath(targetPath)

      if (openError) {
        return { success: false, error: openError }
      }

      return { success: true }
    } catch (error) {
      console.error('Error opening directory in explorer:', error)
      return { success: false, error: error.message || 'Could not open the folder.' }
    }
  })

  // ─── rescan-directory ────────────────────────────────────────────
  // Force a full re-scan of a specific directory.
  ipcMain.handle('rescan-directory', async (_, dirPath) => {
    try {
      const stats = await indexDirectoryIncrementally(dirPath, (progress) => {
        sendNotification(
          JSON.stringify({
            type: 'scan-progress',
            ...progress
          })
        )
      })

      await prisma.directory.updateMany({
        where: { path: dirPath },
        data: {
          totalTracks: stats.totalTracks,
          totalDuration: stats.totalDuration,
          lastScannedAt: new Date()
        }
      })

      invalidateDirectoryCache(dirPath)
      return { success: true, ...stats }
    } catch (error) {
      console.error('Error rescanning directory:', error)
      throw error
    }
  })
}
