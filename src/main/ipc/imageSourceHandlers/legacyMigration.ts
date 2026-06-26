import fs from 'fs'
import { createHash, randomUUID } from 'node:crypto'
import { writeAssetBuffer } from './backgroundAssets.ts'
import {
  normalizeItems,
  readBackgroundConfig,
  saveBackgroundConfig
} from './backgroundConfig.ts'
import {
  buildBackgroundState,
  createBackgroundItem,
  findBackgroundItem,
  sortAndTrimItems,
  upsertBackgroundItem
} from './backgroundState.ts'
import {
  downloadRemoteImage,
  readLocalImageFile
} from './imageSources.ts'
import {
  isDataUrl,
  parseDataUrl,
  sanitizeRemoteUrl
} from './shared.ts'
import type { BackgroundMutationResult } from '../../Types/imageSourceHandlers.ts'

export async function migrateLegacyBackgroundValue(
  legacyValue?: string | null
): Promise<BackgroundMutationResult> {
  if (!legacyValue || typeof legacyValue !== 'string') {
    return { success: true, ...(await buildBackgroundState(readBackgroundConfig())) }
  }

  const trimmedValue = legacyValue.trim()
  if (!trimmedValue) {
    return { success: true, ...(await buildBackgroundState(readBackgroundConfig())) }
  }

  if (isDataUrl(trimmedValue)) {
    try {
      const parsed = parseDataUrl(trimmedValue)
      const config = readBackgroundConfig()
      const contentHash = createHash('sha1').update(trimmedValue).digest('hex')
      const sourceValue = `legacy-data:${contentHash}`
      const existingItem = findBackgroundItem(config, 'local', sourceValue)
      const itemId = existingItem?.id || randomUUID()
      const nextAssetPath = writeAssetBuffer(itemId, parsed.mimeType, parsed.buffer)
      const nextItem = createBackgroundItem({
        sourceType: 'local',
        sourceValue,
        resolvedAssetPath: nextAssetPath,
        mimeType: parsed.mimeType,
        existingItem
      })

      config.currentBackgroundId = nextItem.id
      config.items = normalizeItems([
        nextItem,
        ...config.items.filter((item) => item.id !== nextItem.id)
      ])
      sortAndTrimItems(config)
      saveBackgroundConfig(config)

      return {
        success: true,
        ...(await buildBackgroundState(config))
      }
    } catch (error) {
      console.error('Failed to migrate legacy background data URL:', error)
      return {
        success: false,
        errorCode: 'invalid_data_url',
        errorMessage: 'No se pudo migrar la imagen anterior del fondo.'
      }
    }
  }

  if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
    const remoteResult = await downloadRemoteImage(trimmedValue)
    if (remoteResult.success === false) {
      return remoteResult
    }

    return {
      success: true,
      ...(await upsertBackgroundItem({
        sourceType: 'remote',
        sourceValue: sanitizeRemoteUrl(trimmedValue),
        buffer: remoteResult.buffer,
        mimeType: remoteResult.mimeType
      }))
    }
  }

  if (fs.existsSync(trimmedValue)) {
    const localResult = readLocalImageFile(trimmedValue)
    if (localResult.success === false) {
      return localResult
    }

    return {
      success: true,
      ...(await upsertBackgroundItem({
        sourceType: 'local',
        sourceValue: trimmedValue,
        buffer: localResult.buffer,
        mimeType: localResult.mimeType
      }))
    }
  }

  return {
    success: true,
    ...(await buildBackgroundState(readBackgroundConfig()))
  }
}
