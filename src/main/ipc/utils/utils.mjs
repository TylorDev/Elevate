import { parseFile } from 'music-metadata'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '../../prisma.mjs'
import sharp from 'sharp'

// ─── Cover cache directory ───────────────────────────────────────────
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { app } = require('electron')

function getCoverCacheDir() {
  const base = app.isPackaged ? app.getPath('userData') : path.resolve('.')
  const dir = path.join(base, 'covers')
  fs.mkdirSync(path.join(dir, 'thumb'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'full'), { recursive: true })
  return dir
}

let coverCacheDir = null
function ensureCoverDir() {
  if (!coverCacheDir) coverCacheDir = getCoverCacheDir()
  return coverCacheDir
}

// ─── Helpers ─────────────────────────────────────────────────────────

export async function resizeCover(buffer, size = 128) {
  return sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer()
}

function hashBuffer(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

// getAllAudioFiles has been moved to directoryScanner.mjs (async version)
// Re-export for backward compatibility
export { scanDirectoryAsync as getAllAudioFiles } from './directoryScanner.mjs'

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
    const { common, format } = await parseFile(filepath)

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

/**
 * Gets file info for a list of file paths.
 * Reads metadata from DB when available, only parses new files.
 * No longer sends picture data to the renderer.
 */
export async function getFileInfos(filePaths, { concurrency = 6 } = {}) {
  const fileInfos = await mapWithConcurrency(filePaths, concurrency, async (filePath) => {
    try {
      const fileName = path.basename(filePath, path.extname(filePath))

      // Skip files with # in the name
      if (fileName.includes('#')) {
        return null
      }

      const song = await getOrCreateSong(filePath, fileName)

      const userPreference = await prisma.userPreferences.findUnique({
        where: { song_id: song.song_id },
        select: {
          bpm: true,
          play_count: true,
          is_favorite: true
        }
      })

      return {
        filePath: song.filepath,
        fileName: song.filename,
        title: song.title,
        artist: song.artist,
        album: song.album,
        genre: song.genre,
        year: song.year,
        duration: song.duration,
        size: song.size,
        trackNumber: song.trackNumber,
        coverHash: song.coverHash,
        bpm: userPreference?.bpm || 0,
        play_count: userPreference?.play_count || 0,
        liked: userPreference?.is_favorite || false
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error.message)
      return null
    }
  })

  return fileInfos.filter((info) => info !== null)
}

/**
 * Single file info (convenience wrapper)
 */
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
    const { common } = await parseFile(filePath)
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
  const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')
  const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))
  return getFileInfos(absolutePaths, options)
}

export async function processPlaylistCover(filepath, baseDir) {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')
  const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))
  return getFileCovers(absolutePaths)
}

export async function getFileCovers(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const fileName = path.basename(filePath, path.extname(filePath))
        const song = await getOrCreateSong(filePath, fileName)

        const userPreference = await prisma.userPreferences.findUnique({
          where: { song_id: song.song_id },
          select: { play_count: true }
        })

        // Return minimal data needed for cover generation
        // If coverHash exists, read the cover from disk for generateCover
        let picture = undefined
        if (song.coverHash) {
          const cacheDir = ensureCoverDir()
          const fullCoverPath = path.join(cacheDir, 'full', `${song.coverHash}.jpg`)
          if (fs.existsSync(fullCoverPath)) {
            const buffer = fs.readFileSync(fullCoverPath)
            picture = [{ data: buffer, format: 'image/jpeg', type: 'Cover (front)' }]
          }
        }

        return {
          picture,
          play_count: userPreference?.play_count || 0
        }
      } catch (error) {
        return null
      }
    })
  ).then((fileInfos) => fileInfos.filter((info) => info !== null))
}

// ─── Duration calculation ────────────────────────────────────────────

// getTotalDuration has been moved to directoryScanner.mjs (updateDirectoryStats)
// Re-export for backward compatibility
export { updateDirectoryStats as getTotalDuration } from './directoryScanner.mjs'

// ─── Cover generation (collage) ──────────────────────────────────────

export async function generateCover(files) {
  if (files.length === 0) {
    return null
  }

  const topImages = files
    .filter((file) => file.picture && file.picture[0] && file.picture[0].type !== 'Other')
    .sort((a, b) => b.play_count - a.play_count)
    .slice(0, 4)

  if (topImages.length === 0) {
    return null
  }

  const imageBuffers = topImages.map((item) => Buffer.from(item.picture[0].data))

  try {
    const resizePromises = imageBuffers.map((buffer) =>
      sharp(buffer).resize(250, 250, { fit: 'cover' }).toBuffer()
    )

    const resizedImages = await Promise.all(resizePromises)

    const numImages = resizedImages.length
    const gridSize = Math.ceil(Math.sqrt(numImages))
    const tileSize = 250
    const totalSize = gridSize * tileSize

    const canvas = sharp({
      create: {
        width: totalSize,
        height: totalSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })

    const composites = resizedImages.map((img, index) => {
      const row = Math.floor(index / gridSize)
      const col = index % gridSize
      return {
        input: img,
        top: row * tileSize,
        left: col * tileSize
      }
    })

    const tileBuffer = await canvas.composite(composites).png().toBuffer()
    return tileBuffer
  } catch (error) {
    console.error('Error creating the cover:', error)
    return null
  }
}

// ─── BPM fetching ────────────────────────────────────────────────────

import axios from 'axios'
import { load } from 'cheerio'

const fechtBPM = async (query) => {
  if (!query || query.trim() === '') {
    return { Name: 'No name found', Artist: 'No artist found', bpm: '000' }
  }

  try {
    const response = await axios.get(
      `https://songdata.io/search?query=${encodeURIComponent(query)}`
    )
    const html = response.data
    const $ = load(html)

    const errorH2 = $('h2:contains("An error has occurred, please try again later.")')
    if (errorH2.length) {
      return { Name: 'Error', Artist: 'Error', bpm: 'Error' }
    }

    const firstTableObject = $('tbody .table_object').first()
    const nameElement = firstTableObject.find('.table_name').first()
    const artistElement = firstTableObject.find('.table_artist').first()
    const trackBpm = firstTableObject.find('.table_bpm').first()

    if (!nameElement.length || !artistElement.length || !trackBpm.length) {
      return { Name: 'No name found', Artist: 'No artist found', bpm: '000' }
    }

    return {
      Name: nameElement.text().trim() || 'No name found',
      Artist: artistElement.text().trim() || 'No artist found',
      bpm: trackBpm.text().trim() || '000'
    }
  } catch (error) {
    console.error('Error fetching the data:', error)
    return { Name: 'Error', Artist: 'Error', bpm: 'Error' }
  }
}

export async function getSongBpm(common) {
  try {
    const filePath = common.filePath

    const query = (() => {
      if (common.title && common.artist) {
        return `${common.title}-${common.artist}`
      }
      return ''
    })()

    const songData = await fechtBPM(query)
    const bpm = songData?.bpm || 0

    return {
      ...common,
      bpm
    }
  } catch (error) {
    return null
  }
}
