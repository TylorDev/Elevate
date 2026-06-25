// @ts-nocheck
import {
  extractAudioCover,
  getCoverFromCache,
  getFileInfos,
  resizeCover
} from '../utils/utils.ts'
import { scanDirectoryAsync } from '../utils/directoryScanner.ts'
import { resolveImportableAudioPaths } from '../utils/mediaFileSupport.ts'
import { prisma } from '../../prisma.ts'
import { normalizeAudioPageRequest } from './shared.ts'

const audioPathsCache = new Map()
const audioCoverCache = new Map()
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400

function getAudioPathsCacheKey(dirPath, recursive = true) {
  return `${recursive ? 'recursive' : 'direct'}:${dirPath}`
}

export function clearAudioCaches(dirPath = null) {
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

export async function getCachedAudioFiles(dirPath, { recursive = true } = {}) {
  const cacheKey = getAudioPathsCacheKey(dirPath, recursive)
  const cachedFiles = audioPathsCache.get(cacheKey)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  const files = await resolveImportableAudioPaths(await scanDirectoryAsync(dirPath, recursive))
  audioPathsCache.set(cacheKey, {
    files,
    expiresAt: Date.now() + AUDIO_PATHS_TTL
  })

  return files
}

export async function getUniqueAudioPaths() {
  const directories = await prisma.directory.findMany()

  if (!directories.length) return []

  const allAudioFiles = []
  for (const dir of directories) {
    const files = await getCachedAudioFiles(dir.path, { recursive: true })
    allAudioFiles.push(...files)
  }
  return [...new Set(allAudioFiles)]
}

export async function getAudioFilesPage(request) {
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

export async function getAudioCover(filePath, variant = 'thumb') {
  if (!filePath) return null

  const cacheKey = `${variant}:${filePath}`
  const cachedCover = audioCoverCache.get(cacheKey)

  if (cachedCover && cachedCover.expiresAt > Date.now()) {
    audioCoverCache.delete(cacheKey)
    audioCoverCache.set(cacheKey, cachedCover)
    return cachedCover.cover
  }

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
