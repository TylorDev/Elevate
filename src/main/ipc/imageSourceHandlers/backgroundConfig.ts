import fs from 'fs'
import { getStoragePaths } from '../storagePaths/index.ts'
import type {
  BackgroundConfig,
  BackgroundConfigItem,
  BackgroundItemStatus,
  ImageSourceType
} from '../../Types/imageSourceHandlers.ts'

export function ensureBackgroundStorage(): void {
  fs.mkdirSync(getStoragePaths().backgroundAssetsRoot, { recursive: true })
}

export function getBackgroundAssetsDir(): string {
  return getStoragePaths().backgroundAssetsRoot
}

function getBackgroundConfigPath(): string {
  return getStoragePaths().backgroundConfigPath
}

function defaultBackgroundConfig(): BackgroundConfig {
  return {
    currentBackgroundId: null,
    items: []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

export function readBackgroundConfig(): BackgroundConfig {
  ensureBackgroundStorage()

  try {
    const backgroundConfigPath = getBackgroundConfigPath()

    if (!fs.existsSync(backgroundConfigPath)) {
      return defaultBackgroundConfig()
    }

    const raw = fs.readFileSync(backgroundConfigPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown

    return {
      currentBackgroundId:
        isRecord(parsed) && typeof parsed?.currentBackgroundId === 'string'
          ? parsed.currentBackgroundId
          : null,
      items: isRecord(parsed) && Array.isArray(parsed?.items) ? normalizeItems(parsed.items) : []
    }
  } catch (error) {
    console.error('Failed to read background config:', error)
    return defaultBackgroundConfig()
  }
}

function writeBackgroundConfig(config: BackgroundConfig): void {
  ensureBackgroundStorage()
  fs.writeFileSync(getBackgroundConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

function normalizeStatus(value: unknown): BackgroundItemStatus {
  return value === 'missing' || value === 'invalid' || value === 'ready' ? value : 'ready'
}

function normalizeSourceType(value: unknown): ImageSourceType {
  return value === 'remote' ? 'remote' : 'local'
}

export function normalizeItems(items: unknown[]): BackgroundConfigItem[] {
  return items
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === 'string')
    .map((item) => ({
      id: item.id as string,
      sourceType: normalizeSourceType(item.sourceType),
      sourceValue: typeof item.sourceValue === 'string' ? item.sourceValue : '',
      resolvedAssetPath: typeof item.resolvedAssetPath === 'string' ? item.resolvedAssetPath : '',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'image/png',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : new Date().toISOString(),
      status: normalizeStatus(item.status)
    }))
    .sort((left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime())
}

export function saveBackgroundConfig(config: Partial<BackgroundConfig> | null | undefined): void {
  writeBackgroundConfig({
    currentBackgroundId:
      typeof config?.currentBackgroundId === 'string' ? config.currentBackgroundId : null,
    items: normalizeItems(config?.items || [])
  })
}
