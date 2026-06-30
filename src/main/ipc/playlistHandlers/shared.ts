import path from 'path'
import { buildRankingPageFromTracks } from '../../utils/utils.ts'
import type {
  AudioFileInfo,
  DataUrlBufferResult,
  PageRequest,
  PlaylistInsightRankingId,
  PlaylistInsightRankings
} from '../../Types/playlistHandlers.ts'

export const INSIGHT_METRIC_KEYS: Record<PlaylistInsightRankingId, keyof AudioFileInfo> = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

export const WINDOWS_RESERVED_FILE_NAMES = new Set<string>([
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

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 31) {
      return true
    }
  }

  return false
}

export function stripControlCharacters(value: string): string {
  return Array.from(value).filter((character) => character.charCodeAt(0) > 31).join('')
}

export function getErrorMessage(error: unknown, fallback = 'Unexpected error.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function buildInsightRankingsFromTracks(
  tracks: AudioFileInfo[] = [],
  request: PageRequest = {}
): PlaylistInsightRankings {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce<PlaylistInsightRankings>((rankings, [tabId, metricKey]) => {
    rankings[tabId as PlaylistInsightRankingId] = buildRankingPageFromTracks(tracks, metricKey, {
      page,
      pageSize
    })
    return rankings
  }, {})
}

export function normalizePageRequest(request: PageRequest = {}): { page: number; pageSize: number } {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

export function dataUrlToBuffer(dataUrl: unknown): DataUrlBufferResult | null {
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

export function isSourcePathValue(value = ''): boolean {
  return typeof value === 'string' && value !== '' && !value.startsWith('data:')
}

export function getRandomIndex(total: number): number {
  return Math.floor(Math.random() * total)
}

export function extractPlaylistName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

export function stripPlaylistExtension(nombre = ''): string {
  return String(nombre).trim().replace(/\.m3u$/i, '')
}

export function normalizePlaylistFileName(nombre = ''): string {
  return stripPlaylistExtension(nombre)
}

export function hasInvalidPlaylistNameCharacters(nombre = ''): boolean {
  return /[<>:"/\\|?*]/.test(String(nombre))
}

export function getPlaylistNameValidationError(nombre = ''): string | null {
  const rawName = stripPlaylistExtension(nombre)

  if (!rawName) {
    return 'Enter a valid playlist name.'
  }

  if (hasControlCharacters(rawName)) {
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

export function getTrackPathKey(filePath: string): string {
  const normalizedPath = path.normalize(filePath)
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

export function resolvePlaylistTrackPath(trackPath: string, baseDirectory: string): string {
  return path.isAbsolute(trackPath)
    ? path.normalize(trackPath)
    : path.resolve(baseDirectory, trackPath)
}

export function sanitizePlaylistTrackPaths(filePaths: unknown = []): string[] {
  const uniqueTrackPaths: string[] = []
  const seenPaths = new Set<string>()
  const candidatePaths = Array.isArray(filePaths) ? filePaths : []

  for (const item of candidatePaths) {
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

export function hasDuplicatePlaylistTrackPaths(filePaths: unknown = []): boolean {
  return Array.isArray(filePaths) && sanitizePlaylistTrackPaths(filePaths).length !== filePaths.length
}

export function getPlaylistTrackSignature(filePaths: unknown = []): string {
  return sanitizePlaylistTrackPaths(filePaths).map(getTrackPathKey).join('\n')
}

export function isProtectedPathError(error: unknown): boolean {
  const code = typeof error === 'object' && error ? Reflect.get(error, 'code') : null
  return ['EACCES', 'EPERM', 'EROFS'].includes(String(code))
}

export function getProtectedPathMessage(): string {
  return 'Ruta protegida, No se pudo crear la playlist.'
}

export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}
