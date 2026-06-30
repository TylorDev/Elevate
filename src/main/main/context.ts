import type { BrowserWindow, Tray } from 'electron'
import type { MainProcessContext } from '../Types/main.ts'

export const mainContext: MainProcessContext = {
  mainWindow: null,
  tray: null,
  isQuitting: false,
  hasShutdownStarted: false,
  shutdownComplete: false,
  mainRendererWebContentsId: null
}

export function getMainWindow(): BrowserWindow | null {
  return mainContext.mainWindow
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainContext.mainWindow = window
  mainContext.mainRendererWebContentsId = window?.webContents.id ?? null
}

export function setTray(tray: Tray | null): void {
  mainContext.tray = tray
}

export function resetMainContext(): void {
  Object.assign(mainContext, {
    mainWindow: null,
    tray: null,
    isQuitting: false,
    hasShutdownStarted: false,
    shutdownComplete: false,
    mainRendererWebContentsId: null
  })
}
