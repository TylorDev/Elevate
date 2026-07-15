import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'

import type { ManualQueueOrders, QueueState } from '../../Types/QueueContextTypes/index.ts'

export const EMPTY_QUEUE_STATE: QueueState = {
  currentQueue: [],
  originalQueue: [],
  queueName: ''
}

export type StorageValueParser<T> = (value: unknown) => T

export function readStorageValue<T>(
  key: string,
  fallback: T,
  parse: StorageValueParser<T>
): T {
  if (typeof localStorage === 'undefined') {
    return fallback
  }

  try {
    const saved = localStorage.getItem(key)
    return saved === null ? fallback : parse(JSON.parse(saved))
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error)
    return fallback
  }
}

export function writeStorageValue<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error)
  }
}

function isQueueTrack(value: unknown): value is AudioFileInfo {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.filePath === 'string' && record.filePath.length > 0
}

function normalizeQueue(value: unknown): AudioFileInfo[] {
  return Array.isArray(value) ? value.filter(isQueueTrack) : []
}

export function normalizeCurrentFile(value: unknown): AudioFileInfo | null {
  return isQueueTrack(value) ? value : null
}

export function normalizeQueueState(value: unknown): QueueState {
  if (!value || typeof value !== 'object') {
    return EMPTY_QUEUE_STATE
  }

  const record = value as Record<string, unknown>
  const currentQueue = normalizeQueue(record.currentQueue)
  const originalQueue = normalizeQueue(record.originalQueue)

  return {
    currentQueue,
    originalQueue: originalQueue.length > 0 ? originalQueue : currentQueue,
    queueName: typeof record.queueName === 'string' ? record.queueName : ''
  }
}

export function normalizeIndex(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeManualQueueOrders(value: unknown): ManualQueueOrders {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const result: ManualQueueOrders = {}

  for (const [key, order] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(order)) {
      const validPaths = order.filter((path): path is string => typeof path === 'string')

      if (validPaths.length > 0) {
        result[key] = validPaths
      }
    }
  }

  return result
}
