import { fileURLToPath } from 'node:url'
import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron'
import log from 'electron-log/main.js'
import { resolveMainIconPath } from '../utils/windowAssets.ts'
import { mainContext, setTray } from './context.ts'
import { sendAppCommand } from './rendererEvents.ts'
import { restoreMainWindow } from './windowManager.ts'

const mainDir = fileURLToPath(new URL('.', import.meta.url))

function buildTrayMenu(requestShutdown: () => Promise<void>): Electron.Menu {
  const template: MenuItemConstructorOptions[] = [
    { label: 'Restaurar', click: restoreMainWindow },
    { label: 'Pause/Play', click: () => sendAppCommand('toggle-playback') },
    { label: 'Step', click: () => sendAppCommand('toggle-step') },
    { type: 'separator' },
    { label: 'Cerrar App', click: () => void requestShutdown() }
  ]
  return Menu.buildFromTemplate(template)
}

export function createTray(requestShutdown: () => Promise<void>): Tray | null {
  if (mainContext.tray && !mainContext.tray.isDestroyed()) {
    mainContext.tray.setContextMenu(buildTrayMenu(requestShutdown))
    return mainContext.tray
  }

  const iconPath = resolveMainIconPath(mainDir)
  const trayImage = iconPath ? nativeImage.createFromPath(iconPath) : null
  if (!trayImage || trayImage.isEmpty()) {
    log.error('Tray icon could not be loaded from path:', iconPath)
    return null
  }

  const tray = new Tray(trayImage)
  tray.setToolTip('Elevate')
  tray.setContextMenu(buildTrayMenu(requestShutdown))
  tray.on('click', restoreMainWindow)
  setTray(tray)
  return tray
}

export function destroyTray(): void {
  if (mainContext.tray && !mainContext.tray.isDestroyed()) mainContext.tray.destroy()
  setTray(null)
}
