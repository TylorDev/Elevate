import type { IpcRendererEvent } from 'electron'
import type {
  DiscordPresenceStatus,
  DiscordPresenceUpdatePayload
} from '../main/Types/discordPresence.ts'
import type { StorageDiagnostics } from '../main/Types/storagePaths.ts'
import type {
  AppCommand,
  GridPresetRequest,
  GridPresetResult,
  PrismaStatus,
  TaskbarPlayerStateInput,
  WindowStatePayload
} from '../main/Types/main.ts'

export type IpcCallback = (...args: unknown[]) => void
export type Unsubscribe = () => void

export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    on: (channel: string, callback: IpcCallback) => void
    off: (channel: string, callback: IpcCallback) => void
    removeAllListeners: (channel: string) => void
  }
  webUtils: {
    getPathForFile: (file: File) => string
  }
  windowControls: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    restore: () => Promise<void>
    close: () => Promise<void>
    openExternal: (url: string) => Promise<boolean>
    quit: () => Promise<void>
    getState: () => Promise<WindowStatePayload>
    toggleAlwaysOnTop: () => Promise<void>
    setMinimumSize: (width: number, height: number) => Promise<void>
    applyGridPreset: (selection: GridPresetRequest) => Promise<GridPresetResult>
    updateTaskbarPlayerState: (payload: TaskbarPlayerStateInput) => Promise<void>
    onStateChange: (callback: (payload: WindowStatePayload) => void) => Unsubscribe
    onAppCommand: (callback: (command: AppCommand) => void) => Unsubscribe
  }
  imageSources: {
    validateRemote: (url: string) => Promise<unknown>
    pickLocal: () => Promise<unknown>
  }
  backgroundImages: {
    list: () => Promise<unknown>
    getCurrent: () => Promise<unknown>
    applyRemote: (url: string) => Promise<unknown>
    applyLocal: () => Promise<unknown>
    select: (id: unknown) => Promise<unknown>
    clearCurrent: () => Promise<unknown>
    remove: (id: unknown) => Promise<unknown>
    migrateLegacy: (value: unknown) => Promise<unknown>
  }
  discordPresence: {
    update: (payload: DiscordPresenceUpdatePayload) => Promise<void>
    clear: () => Promise<void>
    getStatus: () => Promise<DiscordPresenceStatus>
  }
  appDiagnostics: {
    getStoragePaths: () => Promise<StorageDiagnostics>
    getDatabaseStatus: () => Promise<PrismaStatus>
  }
}

export type RendererAPI = Record<string, never>
export type IpcBridgeListener = (event: IpcRendererEvent, ...args: unknown[]) => void

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererAPI
  }
}
