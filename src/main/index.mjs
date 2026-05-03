import { createRequire } from 'node:module'
import { join } from 'path'
import { fileURLToPath } from 'url'
import icon from '../../resources/icon.png'

import { setupLikeSongHandlers, setupMusicHandlers } from './ipc/likehandlers.mjs'

import { setupPlaylistHandlers } from './ipc/playlistHandlers.mjs'
import { setupFilehandlers } from './ipc/filehandlers.mjs'

let mainWin
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, shell, BrowserWindow, ipcMain } = electron

export function sendNotification(message) {
  mainWin.webContents.send('notification', message)
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 870,
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
    icon: icon,

    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)), //
      sandbox: false,
      webSecurity: false
    }
  })

  mainWin = mainWindow
  // mainWindow.webContents.openDevTools({ mode: 'bottom' })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

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
app.whenReady().then(() => {
  app.setAppUserModelId('com.electron')
  console.log(process.versions.node)

  ipcMain.on('ping', () => console.log('pong'))

  setupMusicHandlers()
  setupFilehandlers()
  setupPlaylistHandlers()
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
