import fs from 'fs'
import path from 'path'
import { getOrCreateSong } from './utils.mjs'
import { prisma } from '../../prisma.mjs'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg'])
const WALK_YIELD_EVERY = 50
const INDEX_BATCH_SIZE = 20

// ─── Async directory walker ──────────────────────────────────────────

/**
 * Recursively scan a directory for audio files without blocking the event loop.
 * Yields control back to the event loop every WALK_YIELD_EVERY entries.
 */
export async function scanDirectoryAsync(dirPath, recursive = false) {
  const audioFiles = []
  await walkAsync(dirPath, audioFiles, recursive)
  return audioFiles
}

async function walkAsync(dir, audioFiles, recursive) {
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    // Skip inaccessible directories
    return
  }

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && i % WALK_YIELD_EVERY === 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }

    const entry = entries[i]
    const fullPath = path.join(dir, entry.name)

    try {
      if (entry.isDirectory() && recursive) {
        await walkAsync(fullPath, audioFiles, recursive)
      } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        audioFiles.push(fullPath)
      }
    } catch {
      // Skip inaccessible entries
    }
  }
}

// ─── Subdirectory discovery ──────────────────────────────────────────

/**
 * Discover all subdirectories that contain audio directly or through descendants.
 * Empty directories (no audio at any level) are excluded.
 */
export async function discoverSubdirectories(rootPath) {
  const result = []
  await discoverRecursive(rootPath, result)
  return result
}

async function discoverRecursive(dir, result) {
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return false
  }

  let hasDirectAudio = false
  let hasChildAudio = false

  const subdirs = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subdirs.push(path.join(dir, entry.name))
    } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      hasDirectAudio = true
    }
  }

  // Yield control between subdirectories
  for (const subdir of subdirs) {
    await new Promise((resolve) => setImmediate(resolve))
    const childHasAudio = await discoverRecursive(subdir, result)
    if (childHasAudio) hasChildAudio = true
  }

  if (hasDirectAudio || hasChildAudio) {
    result.push(dir)
  }

  return hasDirectAudio || hasChildAudio
}

// ─── Quick check for audio in a directory ────────────────────────────

/**
 * Check if a directory directly contains at least one audio file (non-recursive).
 */
export async function directoryHasAudio(dirPath) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.some(
      (e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase())
    )
  } catch {
    return false
  }
}

// ─── Incremental indexing ────────────────────────────────────────────

/**
 * Index all audio files in a directory, processing metadata in batches.
 * Calls onProgress({ processed, total, dirPath }) between batches.
 * Returns { totalTracks, totalDuration }.
 */
export async function indexDirectoryIncrementally(dirPath, onProgress) {
  // Use recursive=false because we index each sub-directory individually
  // via the loop in add-directory.
  const audioFiles = await scanDirectoryAsync(dirPath, false)
  const total = audioFiles.length

  let totalDuration = 0
  let processed = 0

  for (let i = 0; i < audioFiles.length; i += INDEX_BATCH_SIZE) {
    const batch = audioFiles.slice(i, i + INDEX_BATCH_SIZE)

    const songs = await Promise.all(
      batch.map((filePath) => {
        const fileName = path.basename(filePath, path.extname(filePath))
        return getOrCreateSong(filePath, fileName).catch(() => null)
      })
    )

    for (const song of songs) {
      if (song) {
        totalDuration += song.duration || 0
        processed++
      }
    }

    onProgress?.({ processed, total, dirPath })

    // Yield between batches
    await new Promise((resolve) => setImmediate(resolve))
  }

  return { totalTracks: processed, totalDuration }
}

// ─── Update directory stats from DB ──────────────────────────────────

/**
 * Recompute totalTracks and totalDuration for a directory by querying
 * the Songs table instead of re-parsing files. Updates the Directory row.
 */
export async function updateDirectoryStats(dirPath) {
  // Use recursive=false to only count direct files, since subdirectories
  // are tracked as their own entities in the database.
  const audioFiles = await scanDirectoryAsync(dirPath, false)

  if (audioFiles.length === 0) {
    await prisma.directory.updateMany({
      where: { path: dirPath },
      data: { totalTracks: 0, totalDuration: 0, lastScannedAt: new Date() }
    })
    return { totalTracks: 0, totalDuration: 0 }
  }

  // Query durations from the DB for files we already indexed
  const songs = await prisma.songs.findMany({
    where: { filepath: { in: audioFiles } },
    select: { duration: true }
  })

  const totalTracks = audioFiles.length
  const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0)

  await prisma.directory.updateMany({
    where: { path: dirPath },
    data: { totalTracks, totalDuration, lastScannedAt: new Date() }
  })

  return { totalTracks, totalDuration }
}
