import { randomUUID } from 'node:crypto'
import { prisma } from '../../prisma.ts'
import type {
  VisualizerPresetSource,
  VisualizerPresetSourceModeMap,
  VisualizerPresetSourceModeReverseMap,
  VisualizerPrismaClient,
  VisualizerSource,
  VisualizerSourceTypeMap,
  VisualizerSourceTypeReverseMap
} from '../../Types/visualizerHandlers.ts'
import type { VisualizerPlaybackSourceType } from '../../generated/prisma/client.ts'

export const DEFAULT_CYCLE_DURATION = 6000

export const SOURCE_MODE_TO_DB: VisualizerPresetSourceModeMap = {
  all: 'ALL',
  favorites: 'FAVORITES',
  list: 'LIST'
}

export const SOURCE_MODE_FROM_DB: VisualizerPresetSourceModeReverseMap = {
  ALL: 'all',
  FAVORITES: 'favorites',
  LIST: 'list'
}

export const SOURCE_TYPE_TO_DB: VisualizerSourceTypeMap = {
  favorites: 'FAVORITES',
  playlist: 'PLAYLIST',
  directory: 'DIRECTORY'
}

export const SOURCE_TYPE_FROM_DB: VisualizerSourceTypeReverseMap = {
  FAVORITES: 'favorites',
  PLAYLIST: 'playlist',
  DIRECTORY: 'directory'
}

export const visualizerDb = prisma as unknown as VisualizerPrismaClient

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

export function createStableId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

export function serializeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function normalizePresetSource(rawValue: unknown = {}): VisualizerPresetSource {
  const value = isRecord(rawValue) ? rawValue : {}
  const mode = value.mode === 'favorites' || value.mode === 'list' ? value.mode : 'all'
  const listId = typeof value.listId === 'string' && value.listId.trim() ? value.listId : null

  if (mode === 'list' && listId) {
    return { mode, listId }
  }

  return { mode: mode === 'favorites' ? 'favorites' : 'all', listId: null }
}

export function normalizeSource(rawValue: unknown = {}): VisualizerSource | null {
  const value = isRecord(rawValue) ? rawValue : {}
  const type =
    typeof value.type === 'string' && value.type in SOURCE_TYPE_TO_DB
      ? (value.type as VisualizerSource['type'])
      : null
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : null

  if (!type || !id) {
    return null
  }

  return { type, id }
}

export function getSourceKey(sourceType: VisualizerPlaybackSourceType, sourceId: string): string {
  const type = SOURCE_TYPE_FROM_DB[sourceType]
  return type && sourceId ? `${type}:${sourceId}` : ''
}
