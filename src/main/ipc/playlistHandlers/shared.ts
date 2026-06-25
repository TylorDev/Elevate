// @ts-nocheck
import path from 'path'
import { buildRankingPageFromTracks } from '../utils/utils.ts'

export const INSIGHT_METRIC_KEYS = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export const WINDOWS_RESERVED_FILE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

export function buildInsightRankingsFromTracks(tracks = [], request = {}) {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce((rankings, [tabId, metricKey]) => {
    rankings[tabId] = buildRankingPageFromTracks(tracks, metricKey, { page, pageSize })
    return rankings
  }, {})
}

export function normalizePageRequest(request = {}) {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

export function isSourcePathValue(value = '') {
  return typeof value === 'string' && value !== '' && !value.startsWith('data:')
}

export function getRandomIndex(total) {
  return Math.floor(Math.random() * total)
}

export function extractPlaylistName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

export function stripPlaylistExtension(nombre = '') {
  return String(nombre).trim().replace(/\.m3u$/i, '')
}

export function normalizePlaylistFileName(nombre = '') {
  return stripPlaylistExtension(nombre)
}

export function hasInvalidPlaylistNameCharacters(nombre = '') {
  return /[<>:"/\\|?*]/.test(String(nombre))
}

export function getPlaylistNameValidationError(nombre = '') {
  const rawName = stripPlaylistExtension(nombre)

  if (!rawName) {
    return 'Enter a valid playlist name.'
  }

  if (/[\x00-\x1f]/.test(rawName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (hasInvalidPlaylistNameCharacters(rawName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (/[. ]$/.test(rawName)) {
    return 'El nombre de la playlist no puede terminar en punto o espacio.'
  }

  if (WINDOWS_RESERVED_FILE_NAMES.has(rawName.toUpperCase())) {
    return 'El nombre de la playlist esta reservado por el sistema.'
  }

  const normalizedName = normalizePlaylistFileName(nombre)

  if (!normalizedName) {
    return 'Enter a valid playlist name.'
  }

  return null
}

export function getTrackPathKey(filePath) {
  const normalizedPath = path.normalize(filePath)
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

export function resolvePlaylistTrackPath(trackPath, baseDirectory) {
  return path.isAbsolute(trackPath)
    ? path.normalize(trackPath)
    : path.resolve(baseDirectory, trackPath)
}

export function sanitizePlaylistTrackPaths(filePaths = []) {
  const uniqueTrackPaths = []
  const seenPaths = new Set()

  for (const item of filePaths) {
    if (typeof item !== 'string') {
      continue
    }

    const normalizedPath = item.trim()
    const trackPathKey = getTrackPathKey(normalizedPath)

    if (!normalizedPath || seenPaths.has(trackPathKey)) {
      continue
    }

    seenPaths.add(trackPathKey)
    uniqueTrackPaths.push(normalizedPath)
  }

  return uniqueTrackPaths
}

export function hasDuplicatePlaylistTrackPaths(filePaths = []) {
  return sanitizePlaylistTrackPaths(filePaths).length !== filePaths.length
}

export function getPlaylistTrackSignature(filePaths = []) {
  return sanitizePlaylistTrackPaths(filePaths).map(getTrackPathKey).join('\n')
}

export function isProtectedPathError(error) {
  return ['EACCES', 'EPERM', 'EROFS'].includes(error?.code)
}

export function getProtectedPathMessage() {
  return 'Ruta protegida, No se pudo crear la playlist.'
}

export function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}
