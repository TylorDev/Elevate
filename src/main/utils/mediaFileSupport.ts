// @ts-nocheck
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { getStoragePaths } from '../storagePaths.ts'

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg'])
export const VIDEO_AUDIO_SOURCE_EXTENSIONS = new Set(['.mp4'])
export const SUPPORTED_MEDIA_EXTENSIONS = new Set([
  ...AUDIO_EXTENSIONS,
  ...VIDEO_AUDIO_SOURCE_EXTENSIONS
])

const convertedPathCache = new Map()

export function isSupportedAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isMp4VideoFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.mp4'
}

export function isSupportedMediaFile(filePath) {
  return SUPPORTED_MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function getSourceSignature(filePath) {
  const stats = fs.statSync(filePath)

  return {
    size: stats.size,
    mtimeMs: Math.round(stats.mtimeMs)
  }
}

function getConvertedAudioPath(filePath, signature) {
  const normalizedPath = path.normalize(filePath)
  const sourceName = path.basename(filePath, path.extname(filePath))
  const safeSourceName = sourceName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'video'
  const hash = crypto
    .createHash('sha1')
    .update(`${normalizedPath}|${signature.size}|${signature.mtimeMs}`)
    .digest('hex')
    .slice(0, 16)

  return path.join(getStoragePaths().convertedAudioRoot, hash, `${safeSourceName}.mp3`)
}

export async function resolveImportableAudioPath(filePath) {
  if (!isMp4VideoFile(filePath)) {
    return filePath
  }

  const normalizedPath = path.normalize(filePath)
  const signature = getSourceSignature(normalizedPath)
  const cacheKey = `${normalizedPath}|${signature.size}|${signature.mtimeMs}`
  const cachedPath = convertedPathCache.get(cacheKey)

  if (cachedPath && fs.existsSync(cachedPath)) {
    return cachedPath
  }

  const convertedAudioRoot = getStoragePaths().convertedAudioRoot
  await fs.promises.mkdir(convertedAudioRoot, { recursive: true })

  const convertedPath = getConvertedAudioPath(normalizedPath, signature)
  await fs.promises.mkdir(path.dirname(convertedPath), { recursive: true })

  try {
    const convertedStats = await fs.promises.stat(convertedPath)
    if (convertedStats.size === signature.size) {
      convertedPathCache.set(cacheKey, convertedPath)
      return convertedPath
    }
  } catch {
    // Missing or inaccessible converted copy; recreate it below.
  }

  const tempPath = `${convertedPath}.${process.pid}.${Date.now()}.tmp`
  await fs.promises.copyFile(normalizedPath, tempPath)
  await fs.promises.rename(tempPath, convertedPath)
  convertedPathCache.set(cacheKey, convertedPath)
  return convertedPath
}

export async function resolveImportableAudioPaths(filePaths = []) {
  return Promise.all(
    filePaths.map((filePath) =>
      resolveImportableAudioPath(filePath).catch((error) => {
        console.error(`Error preparing media file ${filePath}:`, error.message)
        return filePath
      })
    )
  )
}
