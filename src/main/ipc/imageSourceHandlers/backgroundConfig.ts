// @ts-nocheck
import fs from 'fs'
import { getStoragePaths } from '../../storagePaths.ts'

export function ensureBackgroundStorage() {
  fs.mkdirSync(getStoragePaths().backgroundAssetsRoot, { recursive: true })
}

export function getBackgroundAssetsDir() {
  return getStoragePaths().backgroundAssetsRoot
}

function getBackgroundConfigPath() {
  return getStoragePaths().backgroundConfigPath
}

function defaultBackgroundConfig() {
  return {
    currentBackgroundId: null,
    items: []
  }
}

export function readBackgroundConfig() {
  ensureBackgroundStorage()

  try {
    const backgroundConfigPath = getBackgroundConfigPath()

    if (!fs.existsSync(backgroundConfigPath)) {
      return defaultBackgroundConfig()
    }

    const raw = fs.readFileSync(backgroundConfigPath, 'utf8')
    const parsed = JSON.parse(raw)

    return {
      currentBackgroundId:
        typeof parsed?.currentBackgroundId === 'string' ? parsed.currentBackgroundId : null,
      items: Array.isArray(parsed?.items) ? parsed.items : []
    }
  } catch (error) {
    console.error('Failed to read background config:', error)
    return defaultBackgroundConfig()
  }
}

function writeBackgroundConfig(config) {
  ensureBackgroundStorage()
  fs.writeFileSync(getBackgroundConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

export function normalizeItems(items) {
  return items
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      sourceType: item.sourceType === 'remote' ? 'remote' : 'local',
      sourceValue: typeof item.sourceValue === 'string' ? item.sourceValue : '',
      resolvedAssetPath: typeof item.resolvedAssetPath === 'string' ? item.resolvedAssetPath : '',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/png',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : new Date().toISOString(),
      status:
        item.status === 'missing' || item.status === 'invalid' || item.status === 'ready'
          ? item.status
          : 'ready'
    }))
    .sort((left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime())
}

export function saveBackgroundConfig(config) {
  writeBackgroundConfig({
    currentBackgroundId:
      typeof config?.currentBackgroundId === 'string' ? config.currentBackgroundId : null,
    items: normalizeItems(config?.items || [])
  })
}
