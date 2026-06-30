import path from 'path'
import type {
  ImageContentTypeCategory,
  ImageExtension,
  ImageMimeType
} from '../../Types/imageSourceHandlers.ts'
import type { MimeBufferPayload } from '../../Types/shared.ts'

export const SUPPORTED_IMAGE_EXTENSIONS: ImageExtension[] = ['jpg', 'jpeg', 'png', 'gif', 'webp']
export const MAX_BACKGROUND_HISTORY_ITEMS = 20

export function sanitizeRemoteUrl(url: string): string {
  const normalized = new URL(url.trim()).toString()
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    throw new Error('invalid_url')
  }
  return normalized
}

export function isDataUrl(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('data:')
}

export function parseDataUrl(dataUrl: string): MimeBufferPayload {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl || '')
  if (!match) {
    throw new Error('invalid_data_url')
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

export function getMimeTypeFromExtension(filePath: string): ImageMimeType | null {
  const extension = path.extname(filePath).toLowerCase().replace('.', '')
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  return null
}

export function getExtensionFromMimeType(mimeType: string): ImageExtension | null {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/webp') return 'webp'
  return null
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export function getContentTypeCategory(
  contentType: string | null | undefined
): ImageContentTypeCategory {
  if (!contentType) return 'unknown'
  if (contentType.includes('text/html')) return 'html'
  if (contentType.startsWith('image/')) return 'image'
  return 'unsupported'
}
