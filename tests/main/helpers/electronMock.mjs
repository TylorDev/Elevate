import { EventEmitter } from 'node:events'
import path from 'node:path'
import { vi } from 'vitest'

const defaultRoot = path.join(process.cwd(), '.vitest-electron')
const ipcHandlers = new Map()
const ipcListeners = new Map()
let nextWebContentsId = 1

let pathOverrides = {}
let openDialogResult = { canceled: true, filePaths: [] }

function createWebContents() {
  return {
    id: nextWebContentsId++,
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isDevToolsOpened: vi.fn(() => false),
    capturePage: vi.fn(() => Promise.resolve({})),
    setWindowOpenHandler: vi.fn()
  }
}

class MockBrowserWindow extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.webContents = createWebContents()
    this.destroyed = false
    this.visible = false
    this.bounds = {
      x: options.x ?? 100,
      y: options.y ?? 100,
      width: options.width ?? 900,
      height: options.height ?? 870
    }
    MockBrowserWindow.instances.push(this)
  }

  static instances = []

  static getAllWindows() {
    return MockBrowserWindow.instances.filter((window) => !window.destroyed)
  }

  static fromWebContents() {
    return MockBrowserWindow.instances[0] || new MockBrowserWindow()
  }

  isDestroyed() {
    return this.destroyed
  }

  destroy() {
    this.destroyed = true
  }

  close() {
    this.emit('close', { preventDefault: vi.fn() })
  }

  show = vi.fn(() => {
    this.visible = true
  })
  hide = vi.fn(() => {
    this.visible = false
  })
  focus = vi.fn()
  minimize = vi.fn()
  maximize = vi.fn()
  unmaximize = vi.fn()
  restore = vi.fn()
  isMaximized = vi.fn(() => false)
  isMinimized = vi.fn(() => false)
  isVisible = vi.fn(() => this.visible)
  getBounds = vi.fn(() => ({ ...this.bounds }))
  setBounds = vi.fn((bounds) => {
    this.bounds = { ...bounds }
  })
  setMinimumSize = vi.fn()
  setAlwaysOnTop = vi.fn()
  isAlwaysOnTop = vi.fn(() => false)
  setSkipTaskbar = vi.fn()
  loadURL = vi.fn()
  loadFile = vi.fn()
  setThumbarButtons = vi.fn()
  setThumbnailToolTip = vi.fn()
}

const appEmitter = new EventEmitter()

export const electronMock = {
  app: Object.assign(appEmitter, {
    isPackaged: true,
    commandLine: {
      appendSwitch: vi.fn()
    },
    disableHardwareAcceleration: vi.fn(),
    getAppPath: vi.fn(() => process.cwd()),
    getPath: vi.fn((name) => pathOverrides[name] || path.join(defaultRoot, name)),
    getVersion: vi.fn(() => '0.0.0-test'),
    setAppUserModelId: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
    quit: vi.fn(),
    relaunch: vi.fn()
  }),
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      ipcHandlers.set(channel, handler)
    }),
    on: vi.fn((channel, listener) => {
      if (!ipcListeners.has(channel)) {
        ipcListeners.set(channel, new Set())
      }
      ipcListeners.get(channel).add(listener)
    }),
    removeHandler: vi.fn((channel) => {
      ipcHandlers.delete(channel)
    }),
    removeAllListeners: vi.fn((channel) => {
      if (channel) {
        ipcListeners.delete(channel)
      } else {
        ipcListeners.clear()
      }
    })
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn()
  },
  BrowserWindow: MockBrowserWindow,
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve(openDialogResult))
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
    openPath: vi.fn(() => Promise.resolve('')),
    showItemInFolder: vi.fn()
  },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn()
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })),
    getAllDisplays: vi.fn(() => [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }
    ]),
    getDisplayMatching: vi.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }))
  },
  Menu: {
    buildFromTemplate: vi.fn((template) => template),
    setApplicationMenu: vi.fn()
  },
  Tray: vi.fn(function MockTray() {
    this.destroyed = false
    this.setToolTip = vi.fn()
    this.setContextMenu = vi.fn()
    this.on = vi.fn()
    this.destroy = vi.fn(() => {
      this.destroyed = true
    })
    this.isDestroyed = vi.fn(() => this.destroyed)
  }),
  nativeImage: {
    createFromPath: vi.fn(() => ({ resize: vi.fn(() => ({})), isEmpty: vi.fn(() => false) })),
    createFromDataURL: vi.fn(() => ({ isEmpty: vi.fn(() => false) }))
  },
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(() => ''),
    writeImage: vi.fn()
  },
  webUtils: {
    getPathForFile: vi.fn((file) => file?.path || '')
  }
}

export function resetElectronMock() {
  appEmitter.removeAllListeners()
  ipcHandlers.clear()
  ipcListeners.clear()
  MockBrowserWindow.instances = []
  nextWebContentsId = 1
  pathOverrides = {}
  openDialogResult = { canceled: true, filePaths: [] }
  electronMock.app.isPackaged = true
  vi.clearAllMocks()
}

export function configureElectronPaths(root) {
  pathOverrides = {
    userData: path.join(root, 'userData'),
    logs: path.join(root, 'logs'),
    appData: path.join(root, 'appData'),
    exe: path.join(root, 'Elevate.exe'),
    home: path.join(root, 'home'),
    music: path.join(root, 'music'),
    documents: path.join(root, 'documents'),
    temp: path.join(root, 'temp')
  }
}

export function setOpenDialogResult(result) {
  openDialogResult = result
}

export function getRegisteredIpcChannels() {
  return [...ipcHandlers.keys()]
}

export async function invokeIpc(channel, ...args) {
  const handler = ipcHandlers.get(channel)
  if (!handler) {
    throw new Error(`No IPC handler registered for ${channel}`)
  }

  return handler(createIpcEvent(), ...args)
}

export function createIpcEvent(overrides = {}) {
  return {
    sender: createWebContents(),
    ...overrides
  }
}
