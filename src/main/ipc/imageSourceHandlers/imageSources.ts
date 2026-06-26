// @ts-nocheck
import { BrowserWindow, dialog } from 'electron'
import fs from 'fs'
import {
  bufferToDataUrl,
  getContentTypeCategory,
  getMimeTypeFromExtension,
  SUPPORTED_IMAGE_EXTENSIONS
} from './shared.ts'

export async function downloadRemoteImage(url) {
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

export function readLocalImageFile(filePath) {
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

export function pickLocalImageFile(event) {
  const win = BrowserWindow.fromWebContents(event.sender)

  return dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: SUPPORTED_IMAGE_EXTENSIONS }]
  })
}

export async function validateRemoteImage(url) {
  const remoteResult = await downloadRemoteImage(url)

  if (!remoteResult.success) {
    return remoteResult
  }

  return {
    success: true,
    resolvedUrl: bufferToDataUrl(remoteResult.buffer, remoteResult.mimeType),
    mimeType: remoteResult.mimeType
  }
}

export async function pickLocalImage(event) {
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
}
