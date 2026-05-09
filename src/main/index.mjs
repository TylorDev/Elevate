import { createRequire } from 'node:module'
import { join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import icon from '../../resources/icon.png'
import log from 'electron-log/main.js'

let mainWin
let prisma
let isQuitting = false
const defaultRemoteDebuggingPort = '9222'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, shell, BrowserWindow, ipcMain, globalShortcut, screen } = electron

try {
  process.loadEnvFile()
} catch (error) {
  if (error?.code !== 'ENOENT') {
    console.warn('Failed to load .env file for Electron main process:', error)
  }
}

if (!app.isPackaged) {
  const remoteDebuggingPort =
    process.env.ELECTRON_REMOTE_DEBUGGING_PORT?.trim() || defaultRemoteDebuggingPort
  app.commandLine.appendSwitch('remote-debugging-port', remoteDebuggingPort)
}

log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}'
log.initialize()

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error.message)
  log.error('Stack:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise)
  log.error('Reason:', reason)
})

const getConfigPath = () => join(app.getPath('userData'), 'window-state.json')

const loadWindowState = () => {
  try {
    const data = fs.readFileSync(getConfigPath(), 'utf-8')
    const state = JSON.parse(data)
    const displays = screen.getAllDisplays()
    const isValid = displays.some(d =>
      state.x >= d.bounds.x && state.x < d.bounds.x + d.bounds.width &&
      state.y >= d.bounds.y && state.y < d.bounds.y + d.bounds.height
    )
    return isValid ? state : null
  } catch {
    return null
  }
}

const saveWindowState = () => {
  if (!mainWin) return
  
  const isMaximized = mainWin.isMaximized()
  const isMinimized = mainWin.isMinimized()
  
  let state = {}
  try {
    state = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'))
  } catch {
    // ignore
  }

  if (!isMaximized && !isMinimized) {
    const bounds = mainWin.getBounds()
    state.x = bounds.x
    state.y = bounds.y
    state.width = bounds.width
    state.height = bounds.height
  }
  
  state.isMaximized = isMaximized
  state.isMinimized = isMinimized

  fs.writeFileSync(getConfigPath(), JSON.stringify(state))
}

export function sendNotification(message) {
  mainWin.webContents.send('notification', message)
}

function createWindow() {
  const savedState = loadWindowState()

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
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',

    titleBarOverlay: {
      color: '#0a0a0a00',
      symbolColor: '#ffffff'
    },
    icon: icon,

    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWin = mainWindow

  mainWindow.on('ready-to-show', () => {
    if (savedState?.isMaximized) {
      mainWindow.maximize()
    } else if (savedState?.isMinimized) {
      mainWindow.minimize()
    } else {
      mainWindow.show()
    }
    globalShortcut.register('F12', () => {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
    })

    globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
    })
  })

  mainWindow.on('close', saveWindowState)
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)
  mainWindow.on('minimize', saveWindowState)
  mainWindow.on('restore', saveWindowState)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

///////////////////
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore()
      mainWin.focus()
    }
  })

  app.whenReady().then(async () => {
  app.setAppUserModelId('com.electron')
  console.log(process.versions.node)

  const prismaModule = await import('./prisma.mjs')
  const [{ setupLikeSongHandlers, setupMusicHandlers }, { setupPlaylistHandlers }, { setupFilehandlers }] =
    await Promise.all([
      import('./ipc/likehandlers.mjs'),
      import('./ipc/playlistHandlers.mjs'),
      import('./ipc/filehandlers.mjs')
    ])

  prisma = prismaModule.prisma
  await prismaModule.initializePrisma()

  log.info('App started, version:', process.versions.node)

  ipcMain.on('ping', () => log.info('pong'))

  setupMusicHandlers()
  setupFilehandlers()
  setupPlaylistHandlers()
  setupLikeSongHandlers()

  // Initialize directory watchers for all existing directories
  const { initializeWatchers } = await import('./ipc/utils/directoryWatcher.mjs')
  await initializeWatchers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('render-process-gone', (event, details) => {
    log.error('Render process gone:', details.reason)
    log.error('Exit code:', details.exitCode)
  })

  app.on('child-process-gone', (event, details) => {
    log.error('Child process gone:', details.reason)
    log.error('Exit code:', details.exitCode)
  })
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (isQuitting) {
      return
    }

    isQuitting = true

    // Stop all directory watchers
    try {
      const { stopAll } = await import('./ipc/utils/directoryWatcher.mjs')
      await stopAll()
    } catch (err) {
      log.error('Error stopping watchers:', err)
    }

    if (prisma) {
      void prisma.$disconnect().finally(() => app.quit())
      return
    }

    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

}
