import { dirname, join, resolve } from 'node:path'
import { app } from 'electron'
import type { StorageRuntimeMode } from '../../Types/storagePaths.ts'

export const UPDATER_CACHE_DIR_NAME = 'elevate-updater'

export function canUsePortableOverride(): boolean {
  return process.env.ELEVATE_ENABLE_PORTABLE_MODE === '1' || !app.isPackaged
}

export function getPortableOverrideRoot(): string | null {
  const rawValue = process.env.ELEVATE_PORTABLE_DATA_DIR
  if (!rawValue || !canUsePortableOverride()) return null
  return resolve(rawValue)
}

export function getResolvedUserDataRoot(): string {
  return getPortableOverrideRoot() || app.getPath('userData')
}

export function getRuntimeMode(): StorageRuntimeMode {
  if (!app.isPackaged) return 'development'
  return getPortableOverrideRoot() ? 'portable-debug-override' : 'installed-release'
}

export function getUpdaterCachePath(): string {
  const localAppData = process.env.LOCALAPPDATA || join(dirname(app.getPath('appData')), 'Local')
  return join(localAppData, UPDATER_CACHE_DIR_NAME)
}
