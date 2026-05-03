import { createRequire } from 'node:module'
import { join } from 'path'
import { fileURLToPath } from 'url'
import icon from '../../resources/icon.png'

let mainWin
let prisma
let isQuitting = false
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, shell, BrowserWindow, ipcMain, globalShortcut } = electron

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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
    if (isQuitting) {
      return
    }

    isQuitting = true
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
