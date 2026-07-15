import { Bounce, type ToastOptions } from 'react-toastify'

import type {
  PlaylistToastNotifier,
  PlaylistToastType,
  PlaylistTrackInput
} from '../../Types/PlaylistContextTypes/index.ts'

export const PLAYLIST_DELETE_TOAST_ID = 'playlist-delete-status'

export const createPlaylistToastOptions = (toastId?: string): ToastOptions => ({
  ...(toastId ? { toastId } : {}),
  position: 'bottom-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'dark',
  transition: Bounce
})

export const createToastNotifier = (
  toastApi: {
    error: (message: string, options?: ToastOptions) => void
    success: (message: string, options?: ToastOptions) => void
    isActive: (toastId: string) => boolean
    update: (toastId: string, options: ToastOptions & { render: string; type: PlaylistToastType }) => void
  }
): PlaylistToastNotifier => {
  return (type, message, toastId) => {
    const options = createPlaylistToastOptions(toastId)

    if (toastId && toastApi.isActive(toastId)) {
      toastApi.update(toastId, {
        ...options,
        render: message,
        type
      })
      return
    }

    toastApi[type](message, options)
  }
}

export const normalizePlaylistPath = (filePath: unknown): string =>
  typeof filePath === 'string' ? filePath.trim() : ''

export const extractTrackPaths = (
  tracks: readonly PlaylistTrackInput[] = [],
  options: { trim?: boolean; unique?: boolean } = {}
): string[] => {
  const { trim = false, unique = false } = options
  const paths: string[] = []

  for (const track of tracks) {
    if (typeof track?.filePath !== 'string') continue

    const filePath = trim ? track.filePath.trim() : track.filePath
    if (!filePath) continue

    if (unique && paths.includes(filePath)) continue
    paths.push(filePath)
  }

  return paths
}

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }

  return fallback
}

export const isSuccessfulResponse = (
  response: unknown
): response is { success: true; [key: string]: unknown } =>
  typeof response === 'object' && response !== null && 'success' in response && response.success === true

export const isCanceledResponse = (response: unknown): boolean =>
  typeof response === 'object' && response !== null && 'canceled' in response && response.canceled === true

export const isScanProgressMessage = (message: unknown): boolean => {
  if (typeof message !== 'string') return false

  try {
    return JSON.parse(message)?.type === 'scan-progress'
  } catch {
    return false
  }
}
