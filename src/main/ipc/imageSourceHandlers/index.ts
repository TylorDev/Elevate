// @ts-nocheck
import { ipcMain } from 'electron'
import {
  clearCurrentBackgroundImage,
  getCurrentBackgroundImage,
  listBackgroundImages,
  removeBackgroundImage,
  selectBackgroundImage,
  upsertBackgroundItem
} from './backgroundState.ts'
import {
  downloadRemoteImage,
  pickLocalImage,
  pickLocalImageFile,
  readLocalImageFile,
  validateRemoteImage
} from './imageSources.ts'
import { migrateLegacyBackgroundValue } from './legacyMigration.ts'
import {
  sanitizeRemoteUrl
} from './shared.ts'

export function setupImageSourceHandlers() {
  ipcMain.handle('image-source:validate-remote', async (_, { url }) => {
    return validateRemoteImage(url)
  })

  ipcMain.handle('image-source:pick-local', async (event) => {
    return pickLocalImage(event)
  })

  ipcMain.handle('background-images:list', async () => {
    return listBackgroundImages()
  })

  ipcMain.handle('background-images:get-current', async () => {
    return getCurrentBackgroundImage()
  })

  ipcMain.handle('background-images:apply-remote', async (_, { url }) => {
    try {
      const normalizedUrl = sanitizeRemoteUrl(url)
      const remoteResult = await downloadRemoteImage(normalizedUrl)

      if (!remoteResult.success) {
        return remoteResult
      }

      return {
        success: true,
        ...(await upsertBackgroundItem({
          sourceType: 'remote',
          sourceValue: normalizedUrl,
          buffer: remoteResult.buffer,
          mimeType: remoteResult.mimeType
        }))
      }
    } catch {
      return {
        success: false,
        errorCode: 'invalid_url',
        errorMessage: 'La URL debe empezar con http:// o https://'
      }
    }
  })

  ipcMain.handle('background-images:apply-local', async (event) => {
    const result = await pickLocalImageFile(event)

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, errorCode: 'canceled', errorMessage: 'Operation canceled' }
    }

    const filePath = result.filePaths[0]
    const localResult = readLocalImageFile(filePath)
    if (!localResult.success) {
      return localResult
    }

    return {
      success: true,
      ...(await upsertBackgroundItem({
        sourceType: 'local',
        sourceValue: filePath,
        buffer: localResult.buffer,
        mimeType: localResult.mimeType
      }))
    }
  })

  ipcMain.handle('background-images:select', async (_, { id }) => {
    return selectBackgroundImage(id)
  })

  ipcMain.handle('background-images:clear-current', async () => {
    return clearCurrentBackgroundImage()
  })

  ipcMain.handle('background-images:remove', async (_, { id }) => {
    return removeBackgroundImage(id)
  })

  ipcMain.handle('background-images:migrate-legacy', async (_, { value }) => {
    return migrateLegacyBackgroundValue(value)
  })
}
