import { EventEmitter } from 'node:events'
import path from 'node:path'
import { vi } from 'vitest'

const defaultRoot = path.join(process.cwd(), '.vitest-electron')
const ipcHandlers = new Map()
const ipcListeners = new Map()

let pathOverrides = {}
let openDialogResult = { canceled: true, filePaths: [] }

function createWebContents() {
  return {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    isDestroyed: vi.fn(() => false)
  }
}

class MockBrowserWindow extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.webContents = createWebContents()
    this.destroyed = false
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

  show = vi.fn()
  hide = vi.fn()
  focus = vi.fn()
  minimize = vi.fn()
  maximize = vi.fn()
  unmaximize = vi.fn()
  restore = vi.fn()
  isMaximized = vi.fn(() => false)
  setMinimumSize = vi.fn()
  setAlwaysOnTop = vi.fn()
  isAlwaysOnTop = vi.fn(() => false)
  setSkipTaskbar = vi.fn()
  loadURL = vi.fn()
  loadFile = vi.fn()
  setThumbarButtons = vi.fn()
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
    getPrimaryDisplay: vi.fn(() => ({ workArea: { width: 1920, height: 1080 } }))
  },
  Menu: {
    buildFromTemplate: vi.fn((template) => template),
    setApplicationMenu: vi.fn()
  },
  Tray: vi.fn(function MockTray() {
    this.setToolTip = vi.fn()
    this.setContextMenu = vi.fn()
    this.on = vi.fn()
    this.destroy = vi.fn()
  }),
  nativeImage: {
    createFromPath: vi.fn(() => ({ resize: vi.fn(() => ({})) }))
  },
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(() => '')
  },
  webUtils: {
    getPathForFile: vi.fn((file) => file?.path || '')
  }
}

export function resetElectronMock() {
  ipcHandlers.clear()
  ipcListeners.clear()
  MockBrowserWindow.instances = []
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
