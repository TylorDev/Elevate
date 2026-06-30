import { nativeImage, type BrowserWindow, type NativeImage, type ThumbarButton } from 'electron'
import type { TaskbarPlayerState, TaskbarPlayerStateInput } from '../Types/main.ts'
import { createSvgDataUrl } from '../utils/windowAssets.ts'
import { getMainWindow } from './context.ts'
import { sendAppCommand } from './rendererEvents.ts'

const DEFAULT_TASKBAR_STATE: TaskbarPlayerState = {
  isPlaying: false,
  title: '',
  artist: '',
  hasPrevious: false,
  hasNext: false,
  previewMode: 'full-window'
}

let taskbarPlayerState: TaskbarPlayerState = { ...DEFAULT_TASKBAR_STATE }
let thumbarIcons: Record<'previous' | 'play' | 'pause' | 'next', NativeImage> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

export function normalizeTaskbarPlayerState(payload: unknown): TaskbarPlayerState {
  const value = isRecord(payload) ? payload : {}
  return {
    isPlaying: Boolean(value.isPlaying),
    title: String(value.title || ''),
    artist: String(value.artist || ''),
    hasPrevious: Boolean(value.hasPrevious),
    hasNext: Boolean(value.hasNext),
    previewMode: value.previewMode === 'cover-clip' ? 'cover-clip' : 'full-window'
  }
}

function createThumbarIcon(pathData: string): NativeImage {
  return nativeImage.createFromDataURL(
    createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path fill="#111111" d="${pathData}" />
      </svg>
    `)
  )
}

function getThumbarIcons(): NonNullable<typeof thumbarIcons> {
  thumbarIcons ??= {
    previous: createThumbarIcon('M11 16l13-8v16zM7 8h2v16H7z'),
    play: createThumbarIcon('M10 8l13 8-13 8z'),
    pause: createThumbarIcon('M10 8h5v16h-5zM18 8h5v16h-5z'),
    next: createThumbarIcon('M9 8l13 8-13 8zM23 8h2v16h-2z')
  }
  return thumbarIcons
}

export function updateTaskbarPlayerState(payload?: TaskbarPlayerStateInput): void {
  taskbarPlayerState = normalizeTaskbarPlayerState(payload)
  updateTaskbarControls()
}

export function updateTaskbarControls(
  mainWindow: BrowserWindow | null = getMainWindow(),
  platform: NodeJS.Platform = process.platform
): void {
  if (platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return

  const icons = getThumbarIcons()
  const tooltipParts = [taskbarPlayerState.title, taskbarPlayerState.artist].filter(Boolean)
  mainWindow.setThumbnailToolTip(tooltipParts.join(' - ') || 'Elevate')

  const buttons: ThumbarButton[] = [
    {
      tooltip: 'Previous',
      icon: icons.previous,
      click: () => sendAppCommand('previous-track'),
      flags: taskbarPlayerState.hasPrevious ? ['dismissonclick'] : ['disabled']
    },
    {
      tooltip: taskbarPlayerState.isPlaying ? 'Pause' : 'Play',
      icon: taskbarPlayerState.isPlaying ? icons.pause : icons.play,
      click: () => sendAppCommand('toggle-playback'),
      flags: ['dismissonclick']
    },
    {
      tooltip: 'Next',
      icon: icons.next,
      click: () => sendAppCommand('next-track'),
      flags: taskbarPlayerState.hasNext ? ['dismissonclick'] : ['disabled']
    }
  ]

  mainWindow.setThumbarButtons(buttons)
}

export function resetTaskbarState(): void {
  taskbarPlayerState = { ...DEFAULT_TASKBAR_STATE }
  thumbarIcons = null
}
