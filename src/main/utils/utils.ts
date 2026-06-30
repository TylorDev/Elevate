// @ts-nocheck
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '../prisma.ts'
import { getStoragePaths } from '../ipc/storagePaths/index.ts'
import { resolveImportableAudioPaths } from './mediaFileSupport.ts'

let sharpModulePromise = null
let musicMetadataModulePromise = null

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').then((module) => module.default)
  }

  return sharpModulePromise
}

async function parseAudioFile(filePath) {
  if (!musicMetadataModulePromise) {
    musicMetadataModulePromise = import('music-metadata')
  }

  const { parseFile } = await musicMetadataModulePromise
  return parseFile(filePath)
}

// ─── Cover cache directory ───────────────────────────────────────────
function getCoverCacheDir() {
  const dir = getStoragePaths().coverCacheRoot
  fs.mkdirSync(path.join(dir, 'thumb'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'full'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'playlist-thumb'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'playlist-full'), { recursive: true })
  return dir
}

let coverCacheDir = null
export function ensureCoverDir() {
  if (!coverCacheDir) coverCacheDir = getCoverCacheDir()
  return coverCacheDir
}

// ─── Helpers ─────────────────────────────────────────────────────────

export async function resizeCover(buffer, size = 128) {
  const sharp = await getSharp()
  return sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer()
}

function hashBuffer(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

function getPlaylistCoverPath(coverHash, variant = 'full') {
  const normalizedVariant = variant === 'thumb' ? 'playlist-thumb' : 'playlist-full'
  return path.join(ensureCoverDir(), normalizedVariant, `${coverHash}.jpg`)
}

export async function savePlaylistCoverToCache(buffer) {
  if (!buffer) {
    return null
  }

  const sharp = await getSharp()
  const normalizedBuffer = await sharp(buffer)
    .jpeg({ quality: 85 })
    .toBuffer()
  const coverHash = hashBuffer(normalizedBuffer)
  const thumbPath = getPlaylistCoverPath(coverHash, 'thumb')
  const fullPath = getPlaylistCoverPath(coverHash, 'full')

  if (!fs.existsSync(thumbPath)) {
    const thumbBuffer = await resizeCover(normalizedBuffer, 128)
    fs.writeFileSync(thumbPath, thumbBuffer)
  }

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, normalizedBuffer)
  }

  return {
    coverHash,
    thumbPath,
    fullPath
  }
}

export async function getPlaylistCoverFromCache(coverHash, variant = 'full') {
  if (!coverHash) return null

  try {
    const coverPath = getPlaylistCoverPath(coverHash, variant)
    if (!fs.existsSync(coverPath)) return null

    const buffer = fs.readFileSync(coverPath)
    return {
      data: buffer,
      mimeType: 'image/jpeg'
    }
  } catch {
    return null
  }
}

export async function deletePlaylistCoverFromCache(coverHash) {
  if (!coverHash) return false

  const references = await prisma.playlist.count({
    where: {
      customCoverHash: coverHash
    }
  })

  if (references > 0) {
    return false
  }

  const thumbPath = getPlaylistCoverPath(coverHash, 'thumb')
  const fullPath = getPlaylistCoverPath(coverHash, 'full')

  for (const targetPath of [thumbPath, fullPath]) {
    if (!fs.existsSync(targetPath)) continue

    try {
      fs.unlinkSync(targetPath)
    } catch (error) {
      console.error(`Error deleting playlist cover asset ${targetPath}:`, error)
    }
  }

  return true
}


// ─── Song CRUD with metadata caching ─────────────────────────────────

/**
 * Get or create a song. On first creation, parses the file for metadata
 * and stores everything in the DB. On subsequent calls, returns DB data directly.
 */
export async function getOrCreateSong(filepath, filename) {
  const existing = await prisma.songs.findUnique({ where: { filepath } })

  if (existing && existing.metadataLoaded) {
    return existing
  }

  // Parse metadata from the actual file (only happens once per song)
  let metadata = {}
  try {
    const stats = fs.statSync(filepath)
    const { common, format } = await parseAudioFile(filepath)

    // Extract cover hash if cover exists
    let coverHash = null
    const picture = common.picture?.find((item) => item?.data && item.type !== 'Other')
    if (picture) {
      coverHash = hashBuffer(Buffer.from(picture.data))

      // Save cover to disk cache if not already there
      const cacheDir = ensureCoverDir()
      const thumbPath = path.join(cacheDir, 'thumb', `${coverHash}.jpg`)
      const fullPath = path.join(cacheDir, 'full', `${coverHash}.jpg`)

      if (!fs.existsSync(thumbPath)) {
        const thumbBuffer = await resizeCover(Buffer.from(picture.data), 128)
        fs.writeFileSync(thumbPath, thumbBuffer)
      }
      if (!fs.existsSync(fullPath)) {
        // Save full cover as-is (jpeg compressed for consistency)
        const sharp = await getSharp()
        const fullBuffer = await sharp(Buffer.from(picture.data))
          .jpeg({ quality: 85 })
          .toBuffer()
        fs.writeFileSync(fullPath, fullBuffer)
      }
    }

    metadata = {
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      genre: common.genre?.[0] || null,
      year: common.year || null,
      duration: format.duration || 0,
      size: stats.size,
      trackNumber: common.track?.no || null,
      coverHash,
      metadataLoaded: true
    }
  } catch (error) {
    console.error(`Error parsing metadata for ${filepath}:`, error.message)
    metadata = { metadataLoaded: true }
  }

  const song = await prisma.songs.upsert({
    where: { filepath },
    update: metadata,
    create: {
      filepath,
      filename,
      ...metadata
    }
  })

  // Ensure UserPreferences exist
  await prisma.userPreferences.upsert({
    where: { song_id: song.song_id },
    update: {},
    create: { song_id: song.song_id }
  })

  return song
}

// ─── Batch file info (reads from DB, no parseFile) ───────────────────

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

export const USER_PREFERENCE_TRACK_SELECT = {
  bpm: true,
  skip_count: true,
  short_view_count: true,
  long_view_count: true,
  long_play_seconds: true,
  active_listening_seconds: true,
  consecutive_repeat_count: true,
  is_favorite: true
}

export function mapSongRecordToFileInfo(song, extras = {}) {
  if (!song) {
    return null
  }

  const preference = Array.isArray(song.UserPreferences)
    ? song.UserPreferences[0]
    : song.UserPreferences

  return {
    song_id: song.song_id,
    filePath: song.filepath,
    fileName: song.filename,
    title: song.title,
    artist: song.artist,
    album: song.album,
    genre: song.genre,
    year: song.year,
    duration: Number(song.duration) || 0,
    size: song.size || 0,
    trackNumber: song.trackNumber,
    coverHash: song.coverHash,
    bpm: preference?.bpm || 0,
    skip_count: preference?.skip_count || 0,
    short_view_count: preference?.short_view_count || 0,
    long_view_count: preference?.long_view_count || 0,
    long_play_seconds: preference?.long_play_seconds || 0,
    active_listening_seconds: preference?.active_listening_seconds || 0,
    consecutive_repeat_count: preference?.consecutive_repeat_count || 0,
    liked: preference?.is_favorite || false,
    ...extras
  }
}

export async function getLastPlayedAtBySongId(songIds = []) {
  const uniqueSongIds = [...new Set(songIds.filter((songId) => Number.isInteger(songId)))]

  if (uniqueSongIds.length === 0) {
    return new Map()
  }

  const historyRecords = await prisma.playHistory.groupBy({
    by: ['song_id'],
    where: {
      song_id: {
        in: uniqueSongIds
      }
    },
    _max: {
      timestamp: true
    }
  })

  return new Map(
    historyRecords
      .map((record) => {
        const lastPlayedAt = record._max?.timestamp
        return lastPlayedAt ? [record.song_id, lastPlayedAt.toISOString()] : null
      })
      .filter(Boolean)
  )
}

export function buildCollectionSummaryFromFileInfos(tracks = [], extras = {}) {
  return tracks.reduce(
    (summary, track) => {
      summary.totalDuration += Number(track?.duration) || 0
      summary.totalShortViews += Number(track?.short_view_count) || 0
      summary.totalLongViews += Number(track?.long_view_count) || 0
      summary.totalAccumulatedDuration += Number(track?.active_listening_seconds) || 0
      summary.totalRepeats += Number(track?.consecutive_repeat_count) || 0
      summary.totalSkips += Number(track?.skip_count) || 0
      summary.trackCount += 1
      return summary
    },
    {
      totalDuration: 0,
      totalShortViews: 0,
      totalLongViews: 0,
      totalAccumulatedDuration: 0,
      totalRepeats: 0,
      totalSkips: 0,
      trackCount: 0,
      ...extras
    }
  )
}

export function buildRankingPageFromTracks(tracks = [], metricKey, { page = 1, pageSize = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 200)
  const rankedTracks = tracks
    .filter((track) => (Number(track?.[metricKey]) || 0) > 0)
    .sort((left, right) => (Number(right?.[metricKey]) || 0) - (Number(left?.[metricKey]) || 0))
  const offset = (safePage - 1) * safePageSize
  const items = rankedTracks.slice(offset, offset + safePageSize)
  const totalValue = rankedTracks.reduce(
    (total, track) => total + (Number(track?.[metricKey]) || 0),
    0
  )

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    totalValue,
    total: rankedTracks.length,
    hasMore: offset + items.length < rankedTracks.length
  }
}

export async function getFileInfosBulk(filePaths = [], { concurrency = 6 } = {}) {
  const orderedFilePaths = Array.isArray(filePaths)
    ? filePaths.filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')
    : []

  if (orderedFilePaths.length === 0) {
    return []
  }

  const importableOrderedFilePaths = await resolveImportableAudioPaths(orderedFilePaths)

  const validFilePaths = importableOrderedFilePaths.filter((filePath) => {
    const fileName = path.basename(filePath, path.extname(filePath))
    return !fileName.includes('#')
  })
  const uniqueFilePaths = [...new Set(validFilePaths)]

  const songs = await prisma.songs.findMany({
    where: {
      filepath: {
        in: uniqueFilePaths
      }
    },
    include: {
      UserPreferences: {
        select: USER_PREFERENCE_TRACK_SELECT
      }
    }
  })
  const songByPath = new Map(songs.map((song) => [song.filepath, song]))
  const missingFilePaths = uniqueFilePaths.filter((filePath) => !songByPath.has(filePath))

  if (missingFilePaths.length > 0) {
    const missingInfos = await mapWithConcurrency(missingFilePaths, concurrency, async (filePath) => {
      try {
        const fileName = path.basename(filePath, path.extname(filePath))
        return await getOrCreateSong(filePath, fileName)
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message)
        return null
      }
    })
    const createdSongIds = missingInfos.filter(Boolean).map((song) => song.song_id)
    const hydratedSongs = createdSongIds.length
      ? await prisma.songs.findMany({
          where: {
            song_id: {
              in: createdSongIds
            }
          },
          include: {
            UserPreferences: {
              select: USER_PREFERENCE_TRACK_SELECT
            }
          }
        })
      : []

    hydratedSongs.forEach((song) => {
      songByPath.set(song.filepath, song)
    })
  }

  const lastPlayedAtBySongId = await getLastPlayedAtBySongId(
    Array.from(songByPath.values()).map((song) => song.song_id)
  )

  return validFilePaths
    .map((filePath) => {
      const song = songByPath.get(filePath)

      return mapSongRecordToFileInfo(song, {
        lastPlayedAt: lastPlayedAtBySongId.get(song?.song_id) || null
      })
    })
    .filter(Boolean)
}

/**
 * Gets file info for a list of file paths.
 * Reads metadata from DB when available, only parses new files.
 * No longer sends picture data to the renderer.
 */
export async function getFileInfos(filePaths, { concurrency = 6 } = {}) {
  return getFileInfosBulk(filePaths, { concurrency })
}

export async function getFileInfo(filePath) {
  const results = await getFileInfos([filePath])
  return results.length > 0 ? results[0] : null
}

// ─── Cover extraction (from disk cache) ──────────────────────────────

/**
 * Extract audio cover. Reads from disk cache first, only parses file if needed.
 */
export async function extractAudioCover(filePath) {
  try {
    // Check if we have a coverHash in the DB
    const song = await prisma.songs.findUnique({
      where: { filepath: filePath },
      select: { coverHash: true }
    })

    if (song?.coverHash) {
      const cacheDir = ensureCoverDir()
      const fullCoverPath = path.join(cacheDir, 'full', `${song.coverHash}.jpg`)

      if (fs.existsSync(fullCoverPath)) {
        const buffer = fs.readFileSync(fullCoverPath)
        return {
          buffer,
          format: 'image/jpeg'
        }
      }
    }

    // Fallback: parse the file (rare case — new file not yet indexed)
    const { common } = await parseAudioFile(filePath)
    const picture = common.picture?.find((item) => item?.data && item.type !== 'Other')

    if (!picture) {
      return null
    }

    return {
      buffer: Buffer.from(picture.data),
      format: picture.format || 'image/jpeg'
    }
  } catch (error) {
    return null
  }
}

// ─── Cover for specific variant (thumb/full from disk) ───────────────

export async function getCoverFromCache(filePath, variant = 'thumb') {
  try {
    const song = await prisma.songs.findUnique({
      where: { filepath: filePath },
      select: { coverHash: true }
    })

    if (!song?.coverHash) return null

    const cacheDir = ensureCoverDir()
    const coverPath = path.join(cacheDir, variant, `${song.coverHash}.jpg`)

    if (!fs.existsSync(coverPath)) return null

    const buffer = fs.readFileSync(coverPath)
    return {
      data: buffer,
      mimeType: 'image/jpeg'
    }
  } catch {
    return null
  }
}

// ─── Playlist processing ─────────────────────────────────────────────

export async function processPlaylist(filepath, baseDir, options = {}) {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const relativePaths = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))
  return getFileInfos(absolutePaths, options)
}
