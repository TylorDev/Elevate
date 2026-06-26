// @ts-nocheck
import fs from 'fs'
import path from 'path'
import {
  ensureBackgroundStorage,
  getBackgroundAssetsDir
} from './backgroundConfig.ts'
import { getExtensionFromMimeType } from './shared.ts'

export function writeAssetBuffer(itemId, mimeType, buffer) {
  ensureBackgroundStorage()
  const extension = getExtensionFromMimeType(mimeType) || 'png'
  const targetPath = path.join(getBackgroundAssetsDir(), `${itemId}.${extension}`)
  fs.writeFileSync(targetPath, buffer)
  return targetPath
}

export function deleteAssetFile(assetPath) {
  if (!assetPath) return

  try {
    if (fs.existsSync(assetPath)) {
      fs.unlinkSync(assetPath)
    }
  } catch (error) {
    console.error('Failed to delete background asset:', error)
  }
}

export function moveAssetIfNeeded(item, nextAssetPath) {
  if (!item?.resolvedAssetPath || item.resolvedAssetPath === nextAssetPath) {
    return
  }

  deleteAssetFile(item.resolvedAssetPath)
}
