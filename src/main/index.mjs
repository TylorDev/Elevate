import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { fileURLToPath } from 'url'
import icon from '../../resources/icon.png?asset'

import { setupLikeSongHandlers, setupMusicHandlers } from './ipc/likehandlers.mjs'
import { setupM3UHandlers } from './ipc/listm3uhandlers.mjs'
import { setupFilehandlers } from './ipc/filehandlers.mjs'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 500, // Ancho mínimo
    minHeight: 400, // Alto mínimo
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a00',
      symbolColor: '#ffffff'
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)), //
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  setTimeout(() => {
    mainWindow.webContents.send('time-passed', { seconds: 10 })
  }, 5000)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  console.log(process.versions.node)

  ipcMain.on('ping', () => console.log('pong'))

  setupMusicHandlers()
  setupFilehandlers()
  setupM3UHandlers()
  setupLikeSongHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
