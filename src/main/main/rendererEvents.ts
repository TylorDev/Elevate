import type { LaunchNotification, NotifyLaunchRenderer } from '../Types/argv.ts'
import type {
  AppCommand,
  MainRendererEventChannel,
  MainRendererEventMap,
  PrismaStatus,
  WindowStatePayload
} from '../Types/main.ts'
import { getMainWindow } from './context.ts'

export function getWindowStatePayload(): WindowStatePayload {
  const candidate = getMainWindow()
  const mainWindow = candidate && !candidate.isDestroyed() ? candidate : null
  return {
    isMaximized: Boolean(mainWindow?.isMaximized()),
    isMinimized: Boolean(mainWindow?.isMinimized()),
    isAlwaysOnTop: Boolean(mainWindow?.isAlwaysOnTop()),
    platform: process.platform
  }
}

export function sendRendererEvent<C extends MainRendererEventChannel>(
  channel: C,
  payload: MainRendererEventMap[C]
): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

export const sendNotification: NotifyLaunchRenderer = (message: LaunchNotification) => {
  sendRendererEvent('notification', message)
}

export function sendWindowState(): void {
  sendRendererEvent('window:state-changed', getWindowStatePayload())
}

export function sendAppCommand(command: AppCommand): void {
  sendRendererEvent('app:command', command)
}

export function sendDatabaseStatus(
  channel: 'database:ready' | 'database:error',
  status: PrismaStatus
): void {
  sendRendererEvent(channel, status)
}
