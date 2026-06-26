import fs from 'fs'
import path from 'path'
import { randomUUID } from 'node:crypto'
import {
  deleteAssetFile,
  moveAssetIfNeeded,
  writeAssetBuffer
} from './backgroundAssets.ts'
import {
  normalizeItems,
  readBackgroundConfig,
  saveBackgroundConfig
} from './backgroundConfig.ts'
import {
  downloadRemoteImage,
  readLocalImageFile
} from './imageSources.ts'
import {
  bufferToDataUrl,
  MAX_BACKGROUND_HISTORY_ITEMS
} from './shared.ts'
import type {
  BackgroundConfig,
  BackgroundConfigItem,
  BackgroundMutationResult,
  BackgroundState,
  CreateBackgroundItemRequest,
  ImageSourceType,
  MaterializedBackgroundItem,
  MaterializedBackgroundItemResult,
  UpsertBackgroundItemRequest
} from '../../Types/imageSourceHandlers.ts'

function getItemSignature(sourceType: ImageSourceType, sourceValue: string): string {
  return `${sourceType}:${sourceValue}`
}

export function createBackgroundItem({
  sourceType,
  sourceValue,
  resolvedAssetPath,
  mimeType,
  existingItem
}: CreateBackgroundItemRequest): BackgroundConfigItem {
  const timestamp = new Date().toISOString()
  const base = existingItem || {
    id: randomUUID(),
    createdAt: timestamp
  }

  return {
    id: base.id,
    sourceType,
    sourceValue,
    resolvedAssetPath,
    mimeType,
    createdAt: base.createdAt,
    lastUsedAt: timestamp,
    status: 'ready'
  }
}

export function sortAndTrimItems(config: BackgroundConfig): void {
  const activeId = config.currentBackgroundId
  const sortedItems = normalizeItems(config.items)
  let keptItems = sortedItems.slice(0, MAX_BACKGROUND_HISTORY_ITEMS)
  const activeItem = activeId ? sortedItems.find((item) => item.id === activeId) : null

  if (
    activeItem &&
    !keptItems.some((item) => item.id === activeItem.id) &&
    keptItems.length >= MAX_BACKGROUND_HISTORY_ITEMS
  ) {
    keptItems = [...keptItems.slice(0, MAX_BACKGROUND_HISTORY_ITEMS - 1), activeItem]
  }

  const keptIds = new Set(keptItems.map((item) => item.id))
  const removedItems = sortedItems.filter((item) => !keptIds.has(item.id))

  for (const removedItem of removedItems) {
    deleteAssetFile(removedItem.resolvedAssetPath)
  }

  config.items = normalizeItems(keptItems)
}

export function findBackgroundItem(
  config: BackgroundConfig,
  sourceType: ImageSourceType,
  sourceValue: string
): BackgroundConfigItem | undefined {
  const signature = getItemSignature(sourceType, sourceValue)
  return config.items.find(
    (item) => getItemSignature(item.sourceType, item.sourceValue) === signature
  )
}

function getDisplaySource(item: BackgroundConfigItem | null | undefined): string {
  if (!item?.sourceValue) return ''
  if (item.sourceType === 'remote') return item.sourceValue
  return path.basename(item.sourceValue)
}

async function materializeItem(item: BackgroundConfigItem): Promise<MaterializedBackgroundItemResult> {
  const nextItem: BackgroundConfigItem = { ...item }

  const assetExists =
    nextItem.resolvedAssetPath &&
    fs.existsSync(nextItem.resolvedAssetPath) &&
    fs.statSync(nextItem.resolvedAssetPath).isFile()

  if (assetExists) {
    const buffer = fs.readFileSync(nextItem.resolvedAssetPath)
    nextItem.status = nextItem.sourceType === 'local' && !fs.existsSync(nextItem.sourceValue) ? 'missing' : 'ready'
    return {
      item: nextItem,
      resolvedUrl: bufferToDataUrl(buffer, nextItem.mimeType)
    }
  }

  if (nextItem.sourceType === 'local') {
    if (!fs.existsSync(nextItem.sourceValue)) {
      nextItem.status = 'missing'
      return {
        item: nextItem,
        resolvedUrl: ''
      }
    }

    const localResult = readLocalImageFile(nextItem.sourceValue)
    if (!localResult.success) {
      nextItem.status = 'invalid'
      return {
        item: nextItem,
        resolvedUrl: ''
      }
    }

    const rebuiltAssetPath = writeAssetBuffer(nextItem.id, localResult.mimeType, localResult.buffer)
    moveAssetIfNeeded(nextItem, rebuiltAssetPath)
    nextItem.resolvedAssetPath = rebuiltAssetPath
    nextItem.mimeType = localResult.mimeType
    nextItem.status = 'ready'

    return {
      item: nextItem,
      resolvedUrl: bufferToDataUrl(localResult.buffer, localResult.mimeType)
    }
  }

  const remoteResult = await downloadRemoteImage(nextItem.sourceValue)
  if (!remoteResult.success) {
    nextItem.status = 'invalid'
    return {
      item: nextItem,
      resolvedUrl: ''
    }
  }

  const rebuiltAssetPath = writeAssetBuffer(nextItem.id, remoteResult.mimeType, remoteResult.buffer)
  moveAssetIfNeeded(nextItem, rebuiltAssetPath)
  nextItem.resolvedAssetPath = rebuiltAssetPath
  nextItem.mimeType = remoteResult.mimeType
  nextItem.status = 'ready'

  return {
    item: nextItem,
    resolvedUrl: bufferToDataUrl(remoteResult.buffer, remoteResult.mimeType)
  }
}

export async function buildBackgroundState(config: BackgroundConfig): Promise<BackgroundState> {
  let didChange = false
  const materializedItems: MaterializedBackgroundItem[] = []

  for (const item of normalizeItems(config.items)) {
    const materialized = await materializeItem(item)
    const nextItem = materialized.item
    materializedItems.push({
      ...nextItem,
      resolvedUrl: materialized.resolvedUrl,
      displaySource: getDisplaySource(nextItem)
    })

    if (
      nextItem.status !== item.status ||
      nextItem.resolvedAssetPath !== item.resolvedAssetPath ||
      nextItem.mimeType !== item.mimeType
    ) {
      didChange = true
    }
  }

  config.items = normalizeItems(
    materializedItems.map((materializedItem) => {
      const { resolvedUrl, displaySource, ...item } = materializedItem
      void resolvedUrl
      void displaySource
      return item
    })
  )

  if (config.currentBackgroundId && !config.items.some((item) => item.id === config.currentBackgroundId)) {
    config.currentBackgroundId = null
    didChange = true
  }

  if (didChange) {
    saveBackgroundConfig(config)
  }

  const current =
    materializedItems.find((item) => item.id === config.currentBackgroundId) || null

  return {
    current,
    items: materializedItems
  }
}

export async function upsertBackgroundItem({
  sourceType,
  sourceValue,
  buffer,
  mimeType
}: UpsertBackgroundItemRequest): Promise<BackgroundState> {
  const config = readBackgroundConfig()
  const existingItem = findBackgroundItem(config, sourceType, sourceValue)
  const itemId = existingItem?.id || randomUUID()
  const nextAssetPath = writeAssetBuffer(itemId, mimeType, buffer)

  if (existingItem?.resolvedAssetPath && existingItem.resolvedAssetPath !== nextAssetPath) {
    deleteAssetFile(existingItem.resolvedAssetPath)
  }

  const nextItem = createBackgroundItem({
    sourceType,
    sourceValue,
    resolvedAssetPath: nextAssetPath,
    mimeType,
    existingItem: existingItem ? { ...existingItem, id: itemId } : null
  })

  config.currentBackgroundId = nextItem.id
  config.items = normalizeItems([
    nextItem,
    ...config.items.filter((item) => item.id !== nextItem.id)
  ])
  sortAndTrimItems(config)
  saveBackgroundConfig(config)

  return buildBackgroundState(config)
}

export async function listBackgroundImages(): Promise<BackgroundState> {
  return buildBackgroundState(readBackgroundConfig())
}

export async function getCurrentBackgroundImage(): Promise<MaterializedBackgroundItem | null> {
  const state = await buildBackgroundState(readBackgroundConfig())
  return state.current
}

export async function selectBackgroundImage(
  id?: string | null
): Promise<BackgroundMutationResult> {
  const config = readBackgroundConfig()
  const item = config.items.find((candidate) => candidate.id === id)

  if (!item) {
    return {
      success: false,
      errorCode: 'not_found',
      errorMessage: 'La imagen seleccionada ya no existe en el historial.'
    }
  }

  const updatedItem = {
    ...item,
    lastUsedAt: new Date().toISOString()
  }

  config.currentBackgroundId = updatedItem.id
  config.items = normalizeItems([
    updatedItem,
    ...config.items.filter((candidate) => candidate.id !== updatedItem.id)
  ])
  saveBackgroundConfig(config)

  return {
    success: true,
    ...(await buildBackgroundState(config))
  }
}

export async function clearCurrentBackgroundImage(): Promise<BackgroundMutationResult> {
  const config = readBackgroundConfig()
  config.currentBackgroundId = null
  saveBackgroundConfig(config)

  return {
    success: true,
    ...(await buildBackgroundState(config))
  }
}

export async function removeBackgroundImage(
  id?: string | null
): Promise<BackgroundMutationResult> {
  const config = readBackgroundConfig()

  if (config.currentBackgroundId === id) {
    return {
      success: false,
      errorCode: 'active_item',
      errorMessage: 'You cannot delete the active image.'
    }
  }

  const item = config.items.find((candidate) => candidate.id === id)
  if (!item) {
    return {
      success: false,
      errorCode: 'not_found',
      errorMessage: 'La imagen seleccionada ya no existe en el historial.'
    }
  }

  deleteAssetFile(item.resolvedAssetPath)
  config.items = config.items.filter((candidate) => candidate.id !== id)
  saveBackgroundConfig(config)

  return {
    success: true,
    ...(await buildBackgroundState(config))
  }
}
