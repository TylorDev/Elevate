import { createRequire } from 'node:module'
import { join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import log from 'electron-log/main.js'
import { markLaunchWindowPending, processAndDispatchLaunchArgs, setupArgvHandlers } from './argv.mjs'
import { runNativeBindingDiagnostics } from './nativeDiagnostics.mjs'
import { getPrismaStatus, initializePrisma, prisma } from './prisma.mjs'
import { getStorageDiagnostics, getStoragePaths } from './storagePaths.mjs'
import {
  initDiscordPresence,
  setPresence,
  clearPresence,
  getStatus as getDiscordStatus,
  shutdownDiscordPresence
} from './discordPresence.mjs'
import { setupLikeSongHandlers, setupMusicHandlers } from './ipc/likehandlers.mjs'
import { setupPlaylistHandlers } from './ipc/playlistHandlers.mjs'
import { setupFilehandlers } from './ipc/filehandlers.mjs'
import { setupPlaylistSaveExplorerHandlers } from './ipc/playlistSaveExplorerHandlers.mjs'
import { setupImageSourceHandlers } from './ipc/imageSourceHandlers.mjs'
import { setupVisualizerHandlers } from './ipc/visualizerHandlers.mjs'
import { initializeWatchers, stopAll as stopDirectoryWatchers } from './ipc/utils/directoryWatcher.mjs'

let mainWin
let isQuitting = false
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, shell, BrowserWindow, ipcMain, globalShortcut, screen, Menu, Tray, nativeImage } = electron
const windowStateChannel = 'window:state-changed'
const appCommandChannel = 'app:command'
let tray = null
let hasShutdownStarted = false

let mainRendererWebContentsId = null
const mainDir = fileURLToPath(new URL('.', import.meta.url))
const rendererDir = fileURLToPath(new URL('../renderer', import.meta.url))
let taskbarPlayerState = {
  isPlaying: false,
  title: '',
  artist: '',
  hasPrevious: false,
  hasNext: false,
  previewMode: 'full-window'
}

function resolveIconPath() {
  const candidates = [
    join(process.resourcesPath || '', 'icon.png'),
    join(process.resourcesPath || '', 'resources', 'icon.png'),
    join(mainDir, '../../resources/icon.png')
  ]

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || ''
}

const iconPath = resolveIconPath()
const trayImage = iconPath ? nativeImage.createFromPath(iconPath) : null

function createSvgDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
}

function createThumbarIcon(pathData) {
  return nativeImage.createFromDataURL(
    createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path fill="#111111" d="${pathData}" />
      </svg>
    `)
  )
}

const thumbarIcons = {
  previous: createThumbarIcon('M11 16l13-8v16zM7 8h2v16H7z'),
  play: createThumbarIcon('M10 8l13 8-13 8z'),
  pause: createThumbarIcon('M10 8h5v16h-5zM18 8h5v16h-5z'),
  next: createThumbarIcon('M9 8l13 8-13 8zM23 8h2v16h-2z')
}

try {
  process.loadEnvFile()
} catch (error) {
  if (error?.code !== 'ENOENT') {
    console.warn('Failed to load .env file for Electron main process:', error)
  }
}

const hardwareAccelerationDisabled =
  process.env.ELECTRON_DISABLE_HARDWARE_ACCELERATION?.trim() === '1'

if (process.platform === 'win32') {
  // On some Windows/driver combinations Chromium's separate GPU process can
  // crash during startup. Running GPU work in-process avoids Electron treating
  // that child-process crash as fatal while keeping acceleration available.
  app.commandLine.appendSwitch('in-process-gpu')
  // The Chromium audio utility process can hit the same startup crash on this
  // environment; keep audio service in-process so playback can initialize.
  app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess')
}

if (process.platform === 'win32' && hardwareAccelerationDisabled) {
  // Some Windows environments crash before first paint when Chromium's GPU
  // process cannot initialize. Keep this as an opt-in emergency fallback
  // because the visualizer/WebGL path expects hardware acceleration by default.
  app.disableHardwareAcceleration()
}

log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}'
log.initialize()
runNativeBindingDiagnostics(log, app)

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error.message)
  log.error('Stack:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise)
  log.error('Reason:', reason)
})

const getConfigPath = () => getStoragePaths().windowStatePath

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
  if (!mainWin || mainWin.isDestroyed() || mainWin.webContents.isDestroyed()) {
    return
  }

  mainWin.webContents.send('notification', message)
}

function getWindowStatePayload() {
  return {
    isMaximized: Boolean(mainWin?.isMaximized?.()),
    isMinimized: Boolean(mainWin?.isMinimized?.()),
    isAlwaysOnTop: Boolean(mainWin?.isAlwaysOnTop?.()),
    platform: process.platform
  }
}

function sendWindowState() {
  if (!mainWin || mainWin.isDestroyed() || mainWin.webContents.isDestroyed()) {
    return
  }

  mainWin.webContents.send(windowStateChannel, getWindowStatePayload())
}

function sendAppCommand(command) {
  if (!mainWin || mainWin.isDestroyed() || mainWin.webContents.isDestroyed()) {
    return
  }

  mainWin.webContents.send(appCommandChannel, command)
}



function getConsoleLogMethod(level) {
  if (level >= 3) return 'error'
  if (level === 2) return 'warn'
  if (level === 1) return 'info'
  return 'debug'
}

function registerRendererDiagnostics(windowInstance) {
  const { webContents } = windowInstance
  mainRendererWebContentsId = webContents.id

  webContents.on('console-message', (event) => {
    const level = event?.level ?? 0
    const message = event?.message ?? ''
    const line = event?.lineNumber ?? event?.line ?? 0
    const sourceId = event?.sourceId ?? ''
    const logMethod = getConsoleLogMethod(level)

    log[logMethod]('[renderer console]', JSON.stringify({
      level,
      message,
      line,
      sourceId,
      webContentsId: webContents.id
    }))
  })

  webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    log.error('[renderer did-fail-load]', JSON.stringify({
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
      webContentsId: webContents.id
    }))
  })

  webContents.on('unresponsive', () => {
    log.error('[renderer unresponsive]', JSON.stringify({
      webContentsId: webContents.id
    }))
  })
}



const GRID_PRESET_CELLS = {
  'top-left': { row: 0, col: 0 },
  'top-right': { row: 0, col: 1 },
  'bottom-left': { row: 1, col: 0 },
  'bottom-right': { row: 1, col: 1 }
}

function normalizeGridPresetCells(cells = []) {
  const normalizedCells = Array.isArray(cells)
    ? [...new Set(cells.filter((cell) => Object.hasOwn(GRID_PRESET_CELLS, cell)))]
    : []

  if (normalizedCells.length === 0) {
    return { success: false, error: 'At least one valid grid cell is required.' }
  }

  const positions = normalizedCells.map((cell) => GRID_PRESET_CELLS[cell])
  const rows = positions.map((position) => position.row)
  const cols = positions.map((position) => position.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1)

  if (expectedCount !== normalizedCells.length) {
    return { success: false, error: 'Grid preset selection must form a continuous rectangle.' }
  }

  return {
    success: true,
    normalizedCells,
    minRow,
    maxRow,
    minCol,
    maxCol
  }
}

function getBoundsForGridPreset(mainWindow, cells = []) {
  const selection = normalizeGridPresetCells(cells)

  if (!selection.success) {
    return selection
  }

  const currentBounds = mainWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const workArea = display?.workArea

  if (!workArea) {
    return { success: false, error: 'Unable to resolve display work area.' }
  }

  const halfWidth = Math.floor(workArea.width / 2)
  const halfHeight = Math.floor(workArea.height / 2)
  const colWidths = [halfWidth, workArea.width - halfWidth]
  const rowHeights = [halfHeight, workArea.height - halfHeight]
  const colStarts = [workArea.x, workArea.x + colWidths[0]]
  const rowStarts = [workArea.y, workArea.y + rowHeights[0]]

  const x = colStarts[selection.minCol]
  const y = rowStarts[selection.minRow]
  const width = colWidths
    .slice(selection.minCol, selection.maxCol + 1)
    .reduce((total, value) => total + value, 0)
  const height = rowHeights
    .slice(selection.minRow, selection.maxRow + 1)
    .reduce((total, value) => total + value, 0)

  return {
    success: true,
    bounds: { x, y, width, height },
    displayId: display.id,
    workArea
  }
}

function updateTaskbarControls() {
  if (process.platform !== 'win32' || !mainWin || mainWin.isDestroyed()) {
    return
  }

  const tooltipParts = [taskbarPlayerState.title, taskbarPlayerState.artist].filter(Boolean)
  const thumbnailTooltip = tooltipParts.join(' - ') || 'Elevate'

  mainWin.setThumbnailToolTip(thumbnailTooltip)

  mainWin.setThumbarButtons([
    {
      tooltip: 'Previous',
      icon: thumbarIcons.previous,
      click: () => sendAppCommand('previous-track'),
      flags: taskbarPlayerState.hasPrevious ? ['dismissonclick'] : ['disabled']
    },
    {
      tooltip: taskbarPlayerState.isPlaying ? 'Pause' : 'Play',
      icon: taskbarPlayerState.isPlaying ? thumbarIcons.pause : thumbarIcons.play,
      click: () => sendAppCommand('toggle-playback'),
      flags: ['dismissonclick']
    },
    {
      tooltip: 'Next',
      icon: thumbarIcons.next,
      click: () => sendAppCommand('next-track'),
      flags: taskbarPlayerState.hasNext ? ['dismissonclick'] : ['disabled']
    }
  ])
}

function restoreMainWindow() {
  if (!mainWin || mainWin.isDestroyed()) {
    return
  }

  if (mainWin.isMinimized()) {
    mainWin.restore()
  }

  if (!mainWin.isVisible()) {
    mainWin.show()
  }

  mainWin.focus()
  sendWindowState()
  updateTaskbarControls()
}

function hideMainWindowToTray() {
  if (!mainWin || mainWin.isDestroyed()) {
    return
  }

  saveWindowState()
  mainWin.hide()
  sendWindowState()
}

async function shutdownApp() {
  if (hasShutdownStarted) {
    return
  }

  hasShutdownStarted = true
  isQuitting = true

  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }

  try {
    await stopDirectoryWatchers()
  } catch (err) {
    log.error('Error stopping watchers:', err)
  }

  try {
    await shutdownDiscordPresence()
  } catch (err) {
    log.error('Error shutting down Discord presence:', err)
  }

  try {
    if (getPrismaStatus().isReady) {
      await prisma.$disconnect()
    }
  } catch (error) {
    log.error('Error disconnecting Prisma:', error)
  }

  app.quit()
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Restaurar',
      click: () => restoreMainWindow()
    },
    {
      label: 'Pause/Play',
      click: () => sendAppCommand('toggle-playback')
    },
    {
      label: 'Step',
      click: () => sendAppCommand('toggle-step')
    },
    {
      type: 'separator'
    },
    {
      label: 'Cerrar App',
      click: () => {
        void shutdownApp()
      }
    }
  ])
}

function createTray() {
  if (tray && !tray.isDestroyed()) {
    tray.setContextMenu(buildTrayMenu())
    return tray
  }

  if (!trayImage || trayImage.isEmpty()) {
    log.error('Tray icon could not be loaded from path:', iconPath)
    return null
  }

  tray = new Tray(trayImage)
  tray.setToolTip('Elevate')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    restoreMainWindow()
  })

  return tray
}

function setupWindowControlHandlers() {
  ipcMain.handle('window:minimize', () => {
    if (!mainWin || mainWin.isDestroyed()) {
      return
    }

    mainWin.minimize()
  })

  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWin || mainWin.isDestroyed()) {
      return
    }

    if (mainWin.isMaximized()) {
      mainWin.unmaximize()
      return
    }

    mainWin.maximize()
  })

  ipcMain.handle('window:close', () => {
    if (!mainWin || mainWin.isDestroyed()) {
      return
    }

    mainWin.close()
  })

  ipcMain.handle('window:open-external', (_, url) => {
    if (typeof url !== 'string' || !url.trim()) {
      return false
    }

    shell.openExternal(url)
    return true
  })

  ipcMain.handle('window:restore', () => {
    restoreMainWindow()
  })

  ipcMain.handle('window:quit', async () => {
    await shutdownApp()
  })

  ipcMain.handle('window:get-state', () => getWindowStatePayload())
  ipcMain.handle('app:get-storage-paths', () => getStorageDiagnostics())
  ipcMain.handle('app:get-database-status', () => getPrismaStatus())
  ipcMain.handle('window:toggle-always-on-top', () => {
    if (!mainWin || mainWin.isDestroyed()) {
      return
    }
    const currentValue = mainWin.isAlwaysOnTop()
    mainWin.setAlwaysOnTop(!currentValue)
    sendWindowState()
  })
  
  ipcMain.handle('window:set-minimum-size', (_, payload) => {
    if (!mainWin || mainWin.isDestroyed()) return
    const { width, height } = payload
    mainWin.setMinimumSize(width, height)
  })

  ipcMain.handle('window:apply-grid-preset', (_, payload = {}) => {
    if (!mainWin || mainWin.isDestroyed()) {
      return { success: false, error: 'Main window is not available.' }
    }

    const result = getBoundsForGridPreset(mainWin, payload?.cells)

    if (!result.success) {
      return result
    }

    if (mainWin.isMaximized()) {
      mainWin.unmaximize()
    }

    if (mainWin.isMinimized()) {
      mainWin.restore()
    }

    mainWin.setBounds(result.bounds)
    mainWin.show()
    mainWin.focus()
    saveWindowState()
    sendWindowState()

    return {
      success: true,
      bounds: result.bounds,
      displayId: result.displayId
    }
  })
  ipcMain.handle('window:update-taskbar-player-state', (_, payload = {}) => {
    taskbarPlayerState = {
      ...taskbarPlayerState,
      isPlaying: Boolean(payload.isPlaying),
      title: String(payload.title || ''),
      artist: String(payload.artist || ''),
      hasPrevious: Boolean(payload.hasPrevious),
      hasNext: Boolean(payload.hasNext),
      previewMode: payload.previewMode === 'cover-clip' ? 'cover-clip' : 'full-window'
    }

    updateTaskbarControls()
  })
}

function createWindow() {
  markLaunchWindowPending()
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
    title: 'Elevate Music Player',
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    icon: iconPath || undefined,

    ...(process.platform === 'linux' && iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWin = mainWindow
  registerRendererDiagnostics(mainWindow)

  mainWindow.on('ready-to-show', () => {
    if (savedState?.isMaximized) {
      mainWindow.maximize()
    } else if (savedState?.isMinimized) {
      mainWindow.minimize()
    } else {
      mainWindow.show()
    }

    sendWindowState()
    updateTaskbarControls()
  })



  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      hideMainWindowToTray()
      return
    }

    saveWindowState()
  })
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('maximize', () => {
    saveWindowState()
    sendWindowState()
  })
  mainWindow.on('unmaximize', () => {
    saveWindowState()
    sendWindowState()
  })
  mainWindow.on('minimize', () => {
    saveWindowState()
    sendWindowState()
  })
  mainWindow.on('restore', () => {
    saveWindowState()
    sendWindowState()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(rendererDir, 'index.html'))
  }
}

///////////////////
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.info('[argv/main] second-instance event', {
      commandLine,
      workingDirectory
    })

    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore()
      mainWin.focus()
    }

    void processAndDispatchLaunchArgs(commandLine.slice(1), {
      mainWindow: mainWin,
      workingDirectory,
      notifyRenderer: sendNotification
    })
  })

  app.whenReady().then(async () => {
  console.time('startup:app-ready')
  app.setAppUserModelId('com.electron')
  log.info('App started, version:', process.versions.node)

  // ── Phase 1: Initialize Prisma (lazy — fast now, no module-scope overhead) ──
  // Deferred to background after the first BrowserWindow starts loading.

  // ── Phase 2: Register all IPC handlers (no I/O, just registration) ──
  ipcMain.on('ping', () => log.info('pong'))
  setupWindowControlHandlers()

  setupMusicHandlers()
  setupFilehandlers()
  setupArgvHandlers()
  setupPlaylistHandlers()
  setupPlaylistSaveExplorerHandlers()
  setupLikeSongHandlers()
  setupImageSourceHandlers()
  setupVisualizerHandlers()

  // Discord Rich Presence IPC handlers
  ipcMain.handle('discord-presence:update', (_, payload) => {
    setPresence(payload)
  })
  ipcMain.handle('discord-presence:clear', () => {
    clearPresence()
  })
  ipcMain.handle('discord-presence:get-status', () => {
    return getDiscordStatus()
  })

  // ── Phase 3: Create tray + window ASAP (renderer starts loading) ──
  console.time('startup:create-window')
  createTray()
  createWindow()
  console.timeEnd('startup:create-window')

  // ── Phase 4: Non-blocking background initialization ──
  console.time('startup:prisma-init')
  initializePrisma()
    .then(() => {
      console.timeEnd('startup:prisma-init')
      log.info('Prisma initialized successfully:', JSON.stringify(getPrismaStatus()))
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('database:ready', getPrismaStatus())
      }
    })
    .catch((err) => {
      console.timeEnd('startup:prisma-init')
      log.error('Prisma initialization failed:', err)
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('database:error', getPrismaStatus())
      }
    })

  // Initialize Discord Rich Presence (non-blocking)
  void initDiscordPresence()

  // Initialize directory watchers in background (non-blocking)
  initializeWatchers().catch((err) => log.error('Error initializing directory watchers:', err))

  // Process launch args in background (non-blocking)
  console.info('[argv/main] initial process.argv', process.argv)
  void processAndDispatchLaunchArgs(process.argv.slice(1), {
    mainWindow: mainWin,
    workingDirectory: process.cwd(),
    notifyRenderer: sendNotification,
    batchWindowMs: 0
  })
  console.timeEnd('startup:app-ready')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('render-process-gone', (event, webContents, details = {}) => {
    const webContentsId = webContents?.id
    const target =
      webContentsId && webContentsId === mainRendererWebContentsId
        ? 'main-renderer'
        : 'devtools-or-secondary'

    if (target === 'devtools-or-secondary' && devToolsToggleInProgress) {
      nativeDevToolsUnavailable = true
    }

    log.error('Render process gone:', JSON.stringify({
      reason: details?.reason,
      exitCode: details?.exitCode,
      webContentsId,
      target,
      devToolsOpened: Boolean(mainWin?.webContents && !mainWin.webContents.isDestroyed() && mainWin.webContents.isDevToolsOpened()),
      duringDevToolsToggle: devToolsToggleInProgress
    }))
  })

  app.on('child-process-gone', (event, details) => {
    log.error('Child process gone:', JSON.stringify(details))
  })
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (!isQuitting) {
      return
    }
  }
})

app.on('will-quit', async () => {
    await shutdownDiscordPresence().catch(() => {})
    if (tray && !tray.isDestroyed()) {
      tray.destroy()
      tray = null
    }
    globalShortcut.unregisterAll()
  })

}
