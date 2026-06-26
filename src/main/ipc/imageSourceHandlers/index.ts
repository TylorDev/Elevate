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
import type {
  ImageSourceArgs,
  ImageSourceChannel,
  ImageSourceInvokeHandler
} from '../../Types/imageSourceHandlers.ts'

export type * from '../../Types/imageSourceHandlers.ts'

function handleImageSource<C extends ImageSourceChannel>(
  channel: C,
  handler: ImageSourceInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as ImageSourceArgs<C>)))
}

export function setupImageSourceHandlers(): void {
  handleImageSource('image-source:validate-remote', async (_event, { url }) => {
    return validateRemoteImage(url || '')
  })

  handleImageSource('image-source:pick-local', async (event) => {
    return pickLocalImage(event)
  })

  handleImageSource('background-images:list', async () => {
    return listBackgroundImages()
  })

  handleImageSource('background-images:get-current', async () => {
    return getCurrentBackgroundImage()
  })

  handleImageSource('background-images:apply-remote', async (_event, { url }) => {
    try {
      const normalizedUrl = sanitizeRemoteUrl(url || '')
      const remoteResult = await downloadRemoteImage(normalizedUrl)

      if (remoteResult.success === false) {
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

  handleImageSource('background-images:apply-local', async (event) => {
    const result = await pickLocalImageFile(event)

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, errorCode: 'canceled', errorMessage: 'Operation canceled' }
    }

    const filePath = result.filePaths[0]
    const localResult = readLocalImageFile(filePath)
    if (localResult.success === false) {
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

  handleImageSource('background-images:select', async (_event, { id }) => {
    return selectBackgroundImage(id)
  })

  handleImageSource('background-images:clear-current', async () => {
    return clearCurrentBackgroundImage()
  })

  handleImageSource('background-images:remove', async (_event, { id }) => {
    return removeBackgroundImage(id)
  })

  handleImageSource('background-images:migrate-legacy', async (_event, { value }) => {
    return migrateLegacyBackgroundValue(value)
  })
}
