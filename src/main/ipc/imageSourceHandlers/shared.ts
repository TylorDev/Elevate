// @ts-nocheck
import path from 'path'

export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
export const MAX_BACKGROUND_HISTORY_ITEMS = 20

export function sanitizeRemoteUrl(url) {
  const normalized = new URL(url.trim()).toString()
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    throw new Error('invalid_url')
  }
  return normalized
}

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:')
}

export function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || '')
  if (!match) {
    throw new Error('invalid_data_url')
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

export function getMimeTypeFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase().replace('.', '')
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  return null
}

export function getExtensionFromMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return null
}

export function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export function getContentTypeCategory(contentType) {
  if (!contentType) return 'unknown'
  if (contentType.includes('text/html')) return 'html'
  if (contentType.startsWith('image/')) return 'image'
  return 'unsupported'
}
