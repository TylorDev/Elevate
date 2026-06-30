import { ipcMain, screen, shell } from 'electron'
import { getPrismaStatus } from '../prisma.ts'
import type { MainIpcArgs, MainIpcChannel, MainIpcHandler } from '../Types/main.ts'
import { calculateGridPresetBounds } from '../utils/windowGrid.ts'
import { getMainWindow } from './context.ts'
import { getWindowStatePayload, sendWindowState } from './rendererEvents.ts'
import { updateTaskbarPlayerState } from './taskbar.ts'
import { restoreMainWindow } from './windowManager.ts'
import { scheduleWindowStateSave } from './windowState.ts'

function handleMain<C extends MainIpcChannel>(channel: C, handler: MainIpcHandler<C>): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as MainIpcArgs<C>)))
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function setupMainIpcHandlers(requestShutdown: () => Promise<void>): void {
  handleMain('window:minimize', () => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
  })
  handleMain('window:toggle-maximize', () => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  handleMain('window:close', () => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
  })
  handleMain('window:open-external', (_event, url) => {
    if (typeof url !== 'string' || !url.trim()) return false
    void shell.openExternal(url)
    return true
  })
  handleMain('window:restore', restoreMainWindow)
  handleMain('window:quit', () => requestShutdown())
  handleMain('window:get-state', getWindowStatePayload)
  handleMain('app:get-database-status', getPrismaStatus)
  handleMain('window:toggle-always-on-top', () => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop())
    sendWindowState()
  })
  handleMain('window:set-minimum-size', (_event, payload) => {
    const mainWindow = getMainWindow()
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      !isPositiveFiniteNumber(payload?.width) ||
      !isPositiveFiniteNumber(payload?.height)
    ) {
      return
    }
    mainWindow.setMinimumSize(payload.width, payload.height)
  })
  handleMain('window:apply-grid-preset', (_event, payload) => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: 'Main window is not available.' }
    }

    const display = screen.getDisplayMatching(mainWindow.getBounds())
    const result = calculateGridPresetBounds(payload?.cells, display?.workArea, display?.id ?? 0)
    if (!result.success) return result
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.setBounds(result.bounds)
    mainWindow.show()
    mainWindow.focus()
    scheduleWindowStateSave(mainWindow)
    sendWindowState()
    return { success: true, bounds: result.bounds, displayId: result.displayId }
  })
  handleMain('window:update-taskbar-player-state', (_event, payload) => {
    updateTaskbarPlayerState(payload)
  })
}
