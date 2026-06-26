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
import type { Directory, PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  AudioCoverCacheEntry,
  AudioCoverPayload,
  AudioCoverVariant,
  AudioFilesPage,
  AudioPageRequest,
  AudioPathsCacheEntry,
  ExtractedAudioCover
} from '../../Types/filehandlers.ts'

const db = prisma as unknown as PrismaClient
const getAudioFileInfos = getFileInfos as (
  filePaths: string[],
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>
const audioPathsCache = new Map<string, AudioPathsCacheEntry>()
const audioCoverCache = new Map<string, AudioCoverCacheEntry>()
const AUDIO_PATHS_TTL = 60 * 1000
const COVER_CACHE_TTL = 10 * 60 * 1000
const COVER_CACHE_LIMIT = 400

function getAudioPathsCacheKey(dirPath: string, recursive = true): string {
  return `${recursive ? 'recursive' : 'direct'}:${dirPath}`
}

export function clearAudioCaches(dirPath: string | null = null): void {
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

export async function getCachedAudioFiles(
  dirPath: string,
  { recursive = true }: { recursive?: boolean } = {}
): Promise<string[]> {
  const cacheKey = getAudioPathsCacheKey(dirPath, recursive)
  const cachedFiles = audioPathsCache.get(cacheKey)

  if (cachedFiles && cachedFiles.expiresAt > Date.now()) {
    return cachedFiles.files
  }

  const scannedFiles = (await scanDirectoryAsync(dirPath, recursive)) as string[]
  const files = (await resolveImportableAudioPaths(scannedFiles)) as string[]
  audioPathsCache.set(cacheKey, {
    files,
    expiresAt: Date.now() + AUDIO_PATHS_TTL
  })

  return files
}

export async function getUniqueAudioPaths(): Promise<string[]> {
  const directories = (await db.directory.findMany()) as Directory[]

  if (!directories.length) return []

  const allAudioFiles: string[] = []
  for (const dir of directories) {
    const files = await getCachedAudioFiles(dir.path, { recursive: true })
    allAudioFiles.push(...files)
  }
  return [...new Set(allAudioFiles)]
}

export async function getAudioFilesPage(request: AudioPageRequest): Promise<AudioFilesPage> {
  const { page, pageSize } = normalizeAudioPageRequest(request)
  const uniqueAudioFiles = await getUniqueAudioPaths()
  const start = (page - 1) * pageSize
  const paginatedAudioFiles = uniqueAudioFiles.slice(start, start + pageSize)
  const items = await getAudioFileInfos(paginatedAudioFiles, { includePicture: false })

  return {
    items,
    page,
    pageSize,
    total: uniqueAudioFiles.length,
    hasMore: start + pageSize < uniqueAudioFiles.length
  }
}

export async function getAudioCover(
  filePath: string | null | undefined,
  variant: AudioCoverVariant = 'thumb'
): Promise<AudioCoverPayload | null> {
  if (!filePath) return null

  const cacheKey = `${variant}:${filePath}`
  const cachedCover = audioCoverCache.get(cacheKey)

  if (cachedCover && cachedCover.expiresAt > Date.now()) {
    audioCoverCache.delete(cacheKey)
    audioCoverCache.set(cacheKey, cachedCover)
    return cachedCover.cover
  }

  const diskCover = (await getCoverFromCache(filePath, variant)) as AudioCoverPayload | null
  if (diskCover) {
    audioCoverCache.set(cacheKey, {
      cover: diskCover,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    while (audioCoverCache.size > COVER_CACHE_LIMIT) {
      const oldestKey = audioCoverCache.keys().next().value
      if (oldestKey) {
        audioCoverCache.delete(oldestKey)
      }
    }
    return diskCover
  }

  const cover = (await extractAudioCover(filePath)) as ExtractedAudioCover | null

  if (!cover) {
    audioCoverCache.set(cacheKey, {
      cover: null,
      expiresAt: Date.now() + COVER_CACHE_TTL
    })
    return null
  }

  const result: AudioCoverPayload =
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
    if (oldestKey) {
      audioCoverCache.delete(oldestKey)
    }
  }

  return result
}
