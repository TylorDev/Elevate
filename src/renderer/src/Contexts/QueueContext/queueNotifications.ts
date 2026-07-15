import { Bounce, toast } from 'react-toastify'

import type {
  QueueNotificationActions,
  QueueTranslator
} from '../../Types/QueueContextTypes/index.ts'

const TOAST_OPTIONS = {
  position: 'bottom-right' as const,
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'dark' as const,
  transition: Bounce
}

export function createQueueNotifications(translate: QueueTranslator): QueueNotificationActions {
  const notifyRemoved = (delayMs = 0): void => {
    const show = () => toast.success(translate('queue.removed'), TOAST_OPTIONS)

    if (delayMs > 0) {
      setTimeout(show, delayMs)
      return
    }

    show()
  }

  const notifySongAdded = (songName: string): void => {
    toast.success(translate('queue.songAdded', { name: songName }), TOAST_OPTIONS)
  }

  return { notifyRemoved, notifySongAdded }
}
