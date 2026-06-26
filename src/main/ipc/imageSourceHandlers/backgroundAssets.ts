import fs from 'fs'
import path from 'path'
import {
  ensureBackgroundStorage,
  getBackgroundAssetsDir
} from './backgroundConfig.ts'
import { getExtensionFromMimeType } from './shared.ts'
import type { BackgroundConfigItem } from '../../Types/imageSourceHandlers.ts'

export function writeAssetBuffer(itemId: string, mimeType: string, buffer: Buffer): string {
  ensureBackgroundStorage()
  const extension = getExtensionFromMimeType(mimeType) || 'png'
  const targetPath = path.join(getBackgroundAssetsDir(), `${itemId}.${extension}`)
  fs.writeFileSync(targetPath, buffer)
  return targetPath
}

export function deleteAssetFile(assetPath?: string | null): void {
  if (!assetPath) return

  try {
    if (fs.existsSync(assetPath)) {
      fs.unlinkSync(assetPath)
    }
  } catch (error) {
    console.error('Failed to delete background asset:', error)
  }
}

export function moveAssetIfNeeded(
  item: Partial<Pick<BackgroundConfigItem, 'resolvedAssetPath'>> | null | undefined,
  nextAssetPath: string
): void {
  if (!item?.resolvedAssetPath || item.resolvedAssetPath === nextAssetPath) {
    return
  }

  deleteAssetFile(item.resolvedAssetPath)
}
