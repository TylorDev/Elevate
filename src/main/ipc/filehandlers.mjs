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
const { app, dialog, ipcMain, shell } = electron
const audioPathsCache = new Map()
const audioCoverCache = new Map()
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400
const FEED_CACHE_SCOPES = ['mixed', 'playlists', 'directories']
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

  if (!dirPath) {
    audioPathsCache.clear()
    audioCoverCache.clear()
    return
  }

  audioPathsCache.delete(dirPath)
  for (const key of audioCoverCache.keys()) {
    if (key.startsWith(`${dirPath}:`) || key.includes(`:${dirPath}:`)) {
      audioCoverCache.delete(key)
    }
  }
}

async function getCachedAudioFiles(dirPath) {
  const cachedFiles = audioPathsCache.get(dirPath)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  // Use recursive=true here because the UI expects to see all files
  // inside the directory, even if we register subdirectories individually.
  const files = await scanDirectoryAsync(dirPath, true)
  audioPathsCache.set(dirPath, {
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
    const files = await getCachedAudioFiles(dir.path)
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

function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
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
  return [
    playlist?.path || '',
    getFileStatSignature(playlist?.path),
    playlist?.numElementos || 0,
    playlist?.duracion || 0,
    playlist?.customCoverMode || '',
    playlist?.customCoverValue || '',
    playlist?.customCoverSelection || '',
    playlist?.customCoverUpdatedAt?.getTime?.() || ''
  ].join('|')
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

function mapSummaryToCollectionEntity({ type, id, name, sourcePath, tracks, summary, cover, recentActivityAt }) {
  return {
    id,
    type,
    name,
    path: sourcePath,
    cover,
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
  const audioFiles = await getCachedAudioFiles(directory.path)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))
  const tracks = await getFileInfos(uniqueAudioFiles, { includePicture: false })
  const cover = await getCachedFeedCollectionCover({
    type: 'directory',
    sourcePath: directory.path,
    signature: getDirectoryFeedCoverSignature(directory, uniqueAudioFiles.length),
    tracks
  })
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: directory.path,
    cover
  })

  return mapSummaryToCollectionEntity({
    type: 'directory',
    id: `directory:${directory.id}`,
    name: getPathLeaf(directory.path),
    sourcePath: directory.path,
    tracks,
    summary,
    cover,
    recentActivityAt: getCollectionRecentActivity(tracks)
  })
}

async function buildPlaylistFeedEntity(playlist, lastOpenedAt = null) {
  const baseDir = path.dirname(playlist.path)
  const tracks = (await processPlaylist(playlist.path, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
  const cover = await getCachedFeedCollectionCover({
    type: 'playlist',
    sourcePath: playlist.path,
    signature: getPlaylistFeedCoverSignature(playlist),
    tracks
  })
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
    sourcePath: playlist.path,
    cover
  })

  return mapSummaryToCollectionEntity({
    type: 'playlist',
    id: `playlist:${playlist.id}`,
    name: playlist.nombre || getPathLeaf(playlist.path),
    sourcePath: playlist.path,
    tracks,
    summary,
    cover,
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
    const playlistEntities = await Promise.all(
      playlists.map((playlist) =>
        buildPlaylistFeedEntity(playlist, lastOpenedAtByPlaylistId.get(playlist.id) || null)
      )
    )
    collections.push(...playlistEntities)
  }

  if (shouldLoadDirectories) {
    const directories = await prisma.directory.findMany()
    const directoryEntities = await Promise.all(
      directories.map((directory) => buildDirectoryFeedEntity(directory))
    )
    collections.push(...directoryEntities)
  }

  return collections
}

async function getFeedCollectionEntities(scope, { forceRefresh = false } = {}) {
  const cachedEntry = feedRankingsCache.get(scope)

  if (!forceRefresh && cachedEntry?.entities) {
    return {
      entities: cachedEntry.entities,
      generatedAt: cachedEntry.generatedAt,
      cached: true
    }
  }

  if (!forceRefresh) {
    const pendingRequest = pendingFeedCollections.get(scope)
    if (pendingRequest) {
      const pendingEntry = await pendingRequest
      return {
        ...pendingEntry,
        cached: true
      }
    }
  } else {
    invalidateFeedCollectionsCache(scope)
    feedCollectionCoverCache.clear()
  }

  const buildPromise = buildFeedCollectionEntities(scope).then((entities) => {
    const entry = {
      entities,
      generatedAt: new Date().toISOString()
    }
    feedRankingsCache.set(scope, entry)
    return entry
  }).finally(() => {
    pendingFeedCollections.delete(scope)
  })

  pendingFeedCollections.set(scope, buildPromise)
  const freshEntry = await buildPromise
  return {
    ...freshEntry,
    cached: false
  }
}

async function getFeedCollectionRankings(request = {}) {
  const normalizedRequest = normalizeFeedRankingsRequest(request)
  const collectionResult = await getFeedCollectionEntities(normalizedRequest.scope, {
    forceRefresh: normalizedRequest.forceRefresh
  })

  return {
    success: true,
    scope: normalizedRequest.scope,
    total: collectionResult.entities.length,
    cached: collectionResult.cached,
    generatedAt: collectionResult.generatedAt,
    rankings: buildCollectionEntityRankings(collectionResult.entities, normalizedRequest)
  }
}

async function getDirectoryDetail(directoryPath) {
  const directory = await prisma.directory.findUnique({
    where: { path: directoryPath }
  })

  if (!directory) {
    return { success: false, error: 'Directory not found' }
  }

  const audioFiles = await getCachedAudioFiles(directoryPath)
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
      directoryData: directory
    },
    tracks,
    summary
  }
}

async function getDirectoryOverview(directoryPath, request = {}) {
  const directory = await prisma.directory.findUnique({
    where: { path: directoryPath }
  })

  if (!directory) {
    return { success: false, error: 'Directory not found' }
  }

  const audioFiles = await getCachedAudioFiles(directoryPath)
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
      directoryData: directory
    },
    summary,
    rankings: buildInsightRankingsFromTracks(tracks, request)
  }
}

async function getDirectoryTracksPage(directoryPath, request = {}) {
  const { page, pageSize } = normalizeCollectionPageRequest(request)
  const audioFiles = await getCachedAudioFiles(directoryPath)
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
  const items = sortedDirectories.slice(start, start + pageSize).map((directory) => ({
    type: 'directory',
    id: directory.id,
    title: getPathLeaf(directory.path),
    subtitle: `${directory.totalTracks ?? 0} tracks`,
    meta: directory.path,
    actionPayload: {
      path: directory.path
    },
    path: directory.path,
    totalTracks: directory.totalTracks,
    totalDuration: directory.totalDuration
  }))

  return {
    items,
    page,
    pageSize,
    total: sortedDirectories.length,
    hasMore: start + items.length < sortedDirectories.length
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
      console.log('directory', directoryPath)
      const directory = await prisma.directory.findUnique({
        where: { path: directoryPath }
      })

      if (!directory) {
        return [] // El directorio no existe en la base de datos, devolver un array vacío
      }

      // Obtener todos los archivos de audio del directorio específico
      const audioFiles = await getCachedAudioFiles(directoryPath)

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
      return { success: false, error: error.message || 'No se pudo cargar el directorio.' }
    }
  })

  ipcMain.handle('collection:get-overview', async (_, request) => {
    try {
      return await getCollectionOverview(request)
    } catch (error) {
      console.error('Error retrieving collection overview:', error)
      return { success: false, error: error.message || 'No se pudo cargar la coleccion.' }
    }
  })

  ipcMain.handle('collection:get-tracks-page', async (_, request) => {
    try {
      return await getCollectionTracksPage(request)
    } catch (error) {
      console.error('Error retrieving collection tracks page:', error)
      return { success: false, error: error.message || 'No se pudieron cargar las canciones.' }
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

  // ─── delete-directory ────────────────────────────────────────────
  ipcMain.handle('delete-directory', async (event, dirPath) => {
    try {
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

  // ─── get-directory-by-path ───────────────────────────────────────
  // Now reads stats directly from the DB instead of recalculating.
  ipcMain.handle('get-directory-by-path', async (event, dirPath) => {
    try {
      const directory = await prisma.directory.findUnique({
        where: { path: dirPath }
      })

      if (!directory) {
        throw new Error('Directory not found')
      }

      // If never scanned, trigger a quick scan
      if (!directory.lastScannedAt) {
        const stats = await updateDirectoryStats(dirPath)
        return { ...directory, ...stats }
      }

      return directory
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
        const directories = await prisma.directory.findMany()

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

        return directories
      })().finally(() => {
        pendingDirectoriesRequest = null
      })

      return pendingDirectoriesRequest
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
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
      return { success: false, error: error.message || 'No se pudo abrir el explorador.' }
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
