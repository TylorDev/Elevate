import type { IpcRendererEvent } from 'electron'

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
    minimize: () => Promise<unknown>
    toggleMaximize: () => Promise<unknown>
    restore: () => Promise<unknown>
    close: () => Promise<unknown>
    openExternal: (url: string) => Promise<unknown>
    quit: () => Promise<unknown>
    getState: () => Promise<unknown>
    toggleAlwaysOnTop: () => Promise<unknown>
    setMinimumSize: (width: number, height: number) => Promise<unknown>
    applyGridPreset: (selection: unknown) => Promise<unknown>
    updateTaskbarPlayerState: (payload: unknown) => Promise<unknown>
    onStateChange: (callback: (payload: unknown) => void) => Unsubscribe
    onAppCommand: (callback: (command: unknown) => void) => Unsubscribe
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
    update: (payload: unknown) => Promise<unknown>
    clear: () => Promise<unknown>
    getStatus: () => Promise<unknown>
  }
  appDiagnostics: {
    getStoragePaths: () => Promise<unknown>
    getDatabaseStatus: () => Promise<unknown>
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
