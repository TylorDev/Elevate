import type { PlaylistDeleteCompletedPayload } from '../../../../main/Types/playlistHandlers.ts'
import type {
  PlaylistDeleteCompletionHandler,
  PlaylistToastNotifier,
  PlaylistTranslator
} from '../../Types/PlaylistContextTypes/index.ts'
import { isScanProgressMessage } from './playlistUtils.ts'

export type PlaylistIpcEventTarget = {
  on: (channel: string, listener: (payload: unknown) => void) => void
  off: (channel: string, listener: (payload: unknown) => void) => void
}

export type PlaylistNotificationDependencies = {
  ipc: PlaylistIpcEventTarget
  getAllSongs: (page?: number, options?: { reset?: boolean }) => Promise<unknown>
  getDirectories: (options?: { force?: boolean }) => Promise<unknown> | unknown
  handlePlaylistDeleteCompleted: PlaylistDeleteCompletionHandler
  notify: PlaylistToastNotifier
  translate: PlaylistTranslator
}

export const registerPlaylistNotifications = (
  dependencies: PlaylistNotificationDependencies
): (() => void) => {
  const {
    ipc,
    getAllSongs,
    getDirectories,
    handlePlaylistDeleteCompleted: onPlaylistDeleteCompleted,
    notify,
    translate
  } = dependencies

  const handleNotification = (message: unknown) => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'toast') {
      const toastMessage = 'message' in message && typeof message.message === 'string' ? message.message : ''
      const variant = 'variant' in message && message.variant === 'error' ? 'error' : 'success'
      notify(variant, toastMessage || translate('toasts.completed'))
      return
    }

    if (message === '[new]' || message === '[directory-changed]') {
      void getAllSongs(1, { reset: true })
      void Promise.resolve(getDirectories({ force: true }))
      if (message === '[directory-changed]') return
    }

    if (isScanProgressMessage(message)) return

    notify('success', typeof message === 'string' && message ? message : translate('toasts.completed'))
  }

  const handlePlaylistDeleteCompleted = (payload: unknown) => {
    handlePlaylistDeleteCompletedEvent(payload, onPlaylistDeleteCompleted)
  }

  ipc.on('notification', handleNotification)
  ipc.on('playlist-delete-completed', handlePlaylistDeleteCompleted)

  return () => {
    ipc.off('notification', handleNotification)
    ipc.off('playlist-delete-completed', handlePlaylistDeleteCompleted)
  }
}

const handlePlaylistDeleteCompletedEvent = (
  payload: unknown,
  handler: PlaylistDeleteCompletionHandler
) => {
  if (!payload || typeof payload !== 'object') return
  handler(payload as PlaylistDeleteCompletedPayload)
}
