// @ts-nocheck
import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'node:crypto'
import { getStoragePaths } from '../storagePaths.ts'

const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_BACKGROUND_HISTORY_ITEMS = 20

function ensureBackgroundStorage() {
  fs.mkdirSync(getStoragePaths().backgroundAssetsRoot, { recursive: true })
}

function getBackgroundAssetsDir() {
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

function readBackgroundConfig() {
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

function normalizeItems(items) {
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

function saveBackgroundConfig(config) {
  writeBackgroundConfig({
    currentBackgroundId:
      typeof config?.currentBackgroundId === 'string' ? config.currentBackgroundId : null,
    items: normalizeItems(config?.items || [])
  })
}

function sanitizeRemoteUrl(url) {
  const normalized = new URL(url.trim()).toString()
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    throw new Error('invalid_url')
  }
  return normalized
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || '')
  if (!match) {
    throw new Error('invalid_data_url')
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

function getMimeTypeFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase().replace('.', '')
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  return null
}

function getExtensionFromMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return null
}

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function getContentTypeCategory(contentType) {
  if (!contentType) return 'unknown'
  if (contentType.includes('text/html')) return 'html'
  if (contentType.startsWith('image/')) return 'image'
  return 'unsupported'
}

async function downloadRemoteImage(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      success: false,
      errorCode: 'invalid_url',
      errorMessage: 'La URL debe empezar con http:// o https://'
    }
  }

  try {
    const response = await globalThis.fetch(url)
    if (!response.ok) {
      return {
        success: false,
        errorCode: 'http_error',
        errorMessage: `The server responded with status ${response.status}`
      }
    }

    const contentTypeHeader = response.headers.get('content-type') || ''
    const contentType = contentTypeHeader.split(';')[0].trim().toLowerCase()
    const typeCategory = getContentTypeCategory(contentType)

    if (typeCategory === 'html') {
      return {
        success: false,
        errorCode: 'html_response',
        errorMessage: 'The URL returned an HTML page instead of an image.'
      }
    }

    if (typeCategory !== 'image') {
      return {
        success: false,
        errorCode: 'unsupported_content_type',
        errorMessage: 'El recurso no es una imagen compatible.'
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      success: true,
      buffer,
      mimeType: contentType
    }
  } catch (error) {
    console.error('Error validating remote image:', error)
    return {
      success: false,
      errorCode: 'network_error',
      errorMessage: 'No se pudo conectar con el servidor de la imagen.'
    }
  }
}

function readLocalImageFile(filePath) {
  try {
    const mimeType = getMimeTypeFromExtension(filePath)
    if (!mimeType) {
      return {
        success: false,
        errorCode: 'unsupported_content_type',
        errorMessage: 'El archivo seleccionado no es una imagen compatible.'
      }
    }

    const buffer = fs.readFileSync(filePath)
    return {
      success: true,
      buffer,
      mimeType
    }
  } catch (error) {
    console.error('Error reading local file:', error)
    return {
      success: false,
      errorCode: 'read_failed',
      errorMessage: 'No se pudo leer la imagen seleccionada.'
    }
  }
}

function writeAssetBuffer(itemId, mimeType, buffer) {
  ensureBackgroundStorage()
  const extension = getExtensionFromMimeType(mimeType) || 'png'
  const targetPath = path.join(getBackgroundAssetsDir(), `${itemId}.${extension}`)
  fs.writeFileSync(targetPath, buffer)
  return targetPath
}

function deleteAssetFile(assetPath) {
  if (!assetPath) return

  try {
    if (fs.existsSync(assetPath)) {
      fs.unlinkSync(assetPath)
    }
  } catch (error) {
    console.error('Failed to delete background asset:', error)
  }
}

function moveAssetIfNeeded(item, nextAssetPath) {
  if (!item?.resolvedAssetPath || item.resolvedAssetPath === nextAssetPath) {
    return
  }

  deleteAssetFile(item.resolvedAssetPath)
}

function pickLocalImageFile(event) {
  const win = BrowserWindow.fromWebContents(event.sender)

  return dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: SUPPORTED_IMAGE_EXTENSIONS }]
  })
}

function getItemSignature(sourceType, sourceValue) {
  return `${sourceType}:${sourceValue}`
}

function createBackgroundItem({ sourceType, sourceValue, resolvedAssetPath, mimeType, existingItem }) {
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

function sortAndTrimItems(config) {
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

function findBackgroundItem(config, sourceType, sourceValue) {
  const signature = getItemSignature(sourceType, sourceValue)
  return config.items.find(
    (item) => getItemSignature(item.sourceType, item.sourceValue) === signature
  )
}

function getDisplaySource(item) {
  if (!item?.sourceValue) return ''
  if (item.sourceType === 'remote') return item.sourceValue
  return path.basename(item.sourceValue)
}

async function materializeItem(item) {
  let nextItem = { ...item }

  const assetExists =
    nextItem.resolvedAssetPath && fs.existsSync(nextItem.resolvedAssetPath) && fs.statSync(nextItem.resolvedAssetPath).isFile()

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

async function buildBackgroundState(config) {
  let didChange = false
  const materializedItems = []

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

async function upsertBackgroundItem({ sourceType, sourceValue, buffer, mimeType }) {
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

async function migrateLegacyBackgroundValue(legacyValue) {
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
    if (!remoteResult.success) {
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
    if (!localResult.success) {
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

export function setupImageSourceHandlers() {
  ipcMain.handle('image-source:validate-remote', async (_, { url }) => {
    const remoteResult = await downloadRemoteImage(url)

    if (!remoteResult.success) {
      return remoteResult
    }

    return {
      success: true,
      resolvedUrl: bufferToDataUrl(remoteResult.buffer, remoteResult.mimeType),
      mimeType: remoteResult.mimeType
    }
  })

  ipcMain.handle('image-source:pick-local', async (event) => {
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
      resolvedUrl: bufferToDataUrl(localResult.buffer, localResult.mimeType),
      mimeType: localResult.mimeType,
      filePath
    }
  })

  ipcMain.handle('background-images:list', async () => {
    return buildBackgroundState(readBackgroundConfig())
  })

  ipcMain.handle('background-images:get-current', async () => {
    const state = await buildBackgroundState(readBackgroundConfig())
    return state.current
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
  })

  ipcMain.handle('background-images:clear-current', async () => {
    const config = readBackgroundConfig()
    config.currentBackgroundId = null
    saveBackgroundConfig(config)

    return {
      success: true,
      ...(await buildBackgroundState(config))
    }
  })

  ipcMain.handle('background-images:remove', async (_, { id }) => {
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
  })

  ipcMain.handle('background-images:migrate-legacy', async (_, { value }) => {
    return migrateLegacyBackgroundValue(value)
  })
}
