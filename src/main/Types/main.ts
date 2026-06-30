import type { BrowserWindow, Rectangle, Tray } from 'electron'
import type { LaunchNotification } from './argv.ts'
import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'
import type { SerializedNativeError } from './nativeDiagnostics.ts'
import type { RequiredErrorResponse, SuccessResponse } from './shared.ts'

export type PrismaStatusError = Pick<SerializedNativeError, 'message' | 'code' | 'stack'>

export type PrismaStatus = {
  isInitializing: boolean
  isReady: boolean
  error: PrismaStatusError | null
  initStartedAt: string | null
  initFinishedAt: string | null
}

export type MainProcessContext = {
  mainWindow: BrowserWindow | null
  tray: Tray | null
  isQuitting: boolean
  hasShutdownStarted: boolean
  shutdownComplete: boolean
  mainRendererWebContentsId: number | null
}

export type PersistedWindowState = Partial<Rectangle> & {
  isMaximized?: boolean
  isMinimized?: boolean
}

export type WindowStatePayload = {
  isMaximized: boolean
  isMinimized: boolean
  isAlwaysOnTop: boolean
  platform: NodeJS.Platform
}

export type GridPresetCell = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type GridPresetRequest = {
  cells?: GridPresetCell[] | null
}

export type NormalizedGridPreset = {
  success: true
  normalizedCells: GridPresetCell[]
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export type GridPresetBounds = {
  success: true
  bounds: Rectangle
  displayId: number
  workArea: Rectangle
}

export type GridPresetCalculationResult = GridPresetBounds | RequiredErrorResponse

export type GridPresetResult =
  | SuccessResponse<{ bounds: Rectangle; displayId: number }>
  | RequiredErrorResponse

export type TaskbarPreviewMode = 'full-window' | 'cover-clip'

export type TaskbarPlayerState = {
  isPlaying: boolean
  title: string
  artist: string
  hasPrevious: boolean
  hasNext: boolean
  previewMode: TaskbarPreviewMode
}

export type TaskbarPlayerStateInput = Partial<TaskbarPlayerState> | null | undefined

export type AppCommand = 'previous-track' | 'toggle-playback' | 'next-track' | 'toggle-step'

export type MinimumWindowSizeRequest = {
  width?: number | null
  height?: number | null
}

export type MainRendererEventMap = {
  notification: LaunchNotification
  'window:state-changed': WindowStatePayload
  'app:command': AppCommand
  'database:ready': PrismaStatus
  'database:error': PrismaStatus
}

export type MainRendererEventChannel = keyof MainRendererEventMap

export type MainIpcContract = {
  'window:minimize': { args: []; result: void }
  'window:toggle-maximize': { args: []; result: void }
  'window:close': { args: []; result: void }
  'window:open-external': { args: [url?: string | null]; result: boolean }
  'window:restore': { args: []; result: void }
  'window:quit': { args: []; result: void }
  'window:get-state': { args: []; result: WindowStatePayload }
  'app:get-database-status': { args: []; result: PrismaStatus }
  'window:toggle-always-on-top': { args: []; result: void }
  'window:set-minimum-size': { args: [payload?: MinimumWindowSizeRequest | null]; result: void }
  'window:apply-grid-preset': {
    args: [payload?: GridPresetRequest | null]
    result: GridPresetResult
  }
  'window:update-taskbar-player-state': { args: [payload?: TaskbarPlayerStateInput]; result: void }
}

export type MainIpcChannel = IpcChannel<MainIpcContract>
export type MainIpcArgs<C extends MainIpcChannel> = IpcArgs<MainIpcContract, C>
export type MainIpcHandler<C extends MainIpcChannel> = IpcInvokeHandler<
  MainIpcArgs<C>,
  MainIpcContract[C]['result']
>
