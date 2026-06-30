import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, shell, type WebContents } from 'electron'
import log from 'electron-log/main.js'
import { markLaunchWindowPending } from '../ipc/argv/index.ts'
import { resolveMainIconPath } from '../utils/windowAssets.ts'
import { getMainWindow, mainContext, setMainWindow } from './context.ts'
import { sendWindowState } from './rendererEvents.ts'
import { updateTaskbarControls } from './taskbar.ts'
import { flushWindowState, loadWindowState, scheduleWindowStateSave } from './windowState.ts'

type RendererLogMethod = 'debug' | 'info' | 'warn' | 'error'

const mainDir = fileURLToPath(new URL('.', import.meta.url))
const rendererDir = fileURLToPath(new URL('../renderer', import.meta.url))

function getConsoleLogMethod(level: number): RendererLogMethod {
  if (level >= 3) return 'error'
  if (level === 2) return 'warn'
  if (level === 1) return 'info'
  return 'debug'
}

export function registerRendererDiagnostics(webContents: WebContents): void {
  mainContext.mainRendererWebContentsId = webContents.id

  webContents.on('console-message', (details) => {
    const level = Number(details.level ?? 0)
    log[getConsoleLogMethod(level)](
      '[renderer console]',
      JSON.stringify({ ...details, webContentsId: webContents.id })
    )
  })

  webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log.error(
        '[renderer did-fail-load]',
        JSON.stringify({
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
          webContentsId: webContents.id
        })
      )
    }
  )

  webContents.on('unresponsive', () => {
    log.error('[renderer unresponsive]', JSON.stringify({ webContentsId: webContents.id }))
  })
}

export function restoreMainWindow(): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  sendWindowState()
  updateTaskbarControls()
}

export function hideMainWindowToTray(): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) return
  scheduleWindowStateSave(mainWindow)
  mainWindow.hide()
  sendWindowState()
}

export async function createMainWindow(): Promise<BrowserWindow> {
  markLaunchWindowPending()
  const savedState = await loadWindowState()
  const iconPath = resolveMainIconPath(mainDir)
  const mainWindow = new BrowserWindow({
    x: savedState?.x ?? 100,
    y: savedState?.y ?? 100,
    width: savedState?.width ?? 900,
    height: savedState?.height ?? 870,
    minWidth: 500,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    title: 'Elevate Music Player',
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    icon: iconPath || undefined,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      sandbox: false,
      webSecurity: false
    }
  })

  setMainWindow(mainWindow)
  registerRendererDiagnostics(mainWindow.webContents)

  mainWindow.on('ready-to-show', () => {
    if (savedState?.isMaximized) mainWindow.maximize()
    else if (savedState?.isMinimized) mainWindow.minimize()
    else mainWindow.show()
    sendWindowState()
    updateTaskbarControls()
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key !== 'F12' || input.type !== 'keyDown') return
    void mainWindow.webContents
      .capturePage()
      .then((image) => {
        clipboard.writeImage(image)
        log.info('Screenshot captured and copied to clipboard')
      })
      .catch((error) => log.error('Failed to capture screenshot', error))
  })

  mainWindow.on('close', (event) => {
    if (!mainContext.isQuitting) {
      event.preventDefault()
      hideMainWindowToTray()
      return
    }
    void flushWindowState(mainWindow)
  })

  const scheduleSave = () => scheduleWindowStateSave(mainWindow)
  const scheduleSaveAndNotify = () => {
    scheduleWindowStateSave(mainWindow)
    sendWindowState()
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move', scheduleSave)
  mainWindow.on('maximize', scheduleSaveAndNotify)
  mainWindow.on('unmaximize', scheduleSaveAndNotify)
  mainWindow.on('minimize', scheduleSaveAndNotify)
  mainWindow.on('restore', scheduleSaveAndNotify)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(rendererDir, 'index.html'))
  }

  return mainWindow
}
