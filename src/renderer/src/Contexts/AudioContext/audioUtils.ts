import type { ToastOptions } from 'react-toastify'

export const SHORT_VIEW_MS = 10_000
export const SKIP_WINDOW_MS = 30_000
export const LONG_VIEW_COMPLETION_THRESHOLD = 0.7
export const LONG_VIEW_MIN_ACTIVE_LISTENING_RATIO = 0.4
export const REPLAY_RESTART_THRESHOLD = 0.16
export const REPLAY_WRAP_BACKTRACK_MS = 1_500

export const TOAST_OPTIONS = {
  position: 'bottom-right',
  autoClose: 1400,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'dark'
} satisfies ToastOptions

export function sanitizePath(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null
  }

  let nextPath = filePath.replace(/\\/g, '/').replace(/#/g, '%23')

  if (/^([a-zA-Z]):/.test(nextPath)) {
    nextPath = `file:///${nextPath}`
  }

  return nextPath
}

export function toNonNegativeNumber(value: unknown, fallback = 0): number {
  return Math.max(0, Number(value) || fallback)
}
