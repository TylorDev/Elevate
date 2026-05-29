import { createRequire } from 'node:module'

// Custom APIs for renderer
const api = {}
const require = createRequire(import.meta.url)
const electron = require('electron')
const { contextBridge, ipcRenderer, webUtils } = electron
const windowStateChannel = 'window:state-changed'
const appCommandChannel = 'app:command'
const electronAPI = {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    },
    off: (channel, callback) => {
      ipcRenderer.removeListener(channel, (event, ...args) => callback(...args))
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel)
    }
  },
  webUtils: {
    getPathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch {
        return ''
      }
    }
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    restore: () => ipcRenderer.invoke('window:restore'),
    close: () => ipcRenderer.invoke('window:close'),
    openExternal: (url) => ipcRenderer.invoke('window:open-external', url),
    quit: () => ipcRenderer.invoke('window:quit'),
    getState: () => ipcRenderer.invoke('window:get-state'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
    setMinimumSize: (width, height) => ipcRenderer.invoke('window:set-minimum-size', { width, height }),
    applyGridPreset: (selection) => ipcRenderer.invoke('window:apply-grid-preset', selection),
    updateTaskbarPlayerState: (payload) => ipcRenderer.invoke('window:update-taskbar-player-state', payload),
    onStateChange: (callback) => {
      const listener = (_, payload) => callback(payload)
      ipcRenderer.on(windowStateChannel, listener)
      return () => {
        ipcRenderer.removeListener(windowStateChannel, listener)
      }
    },
    onAppCommand: (callback) => {
      const listener = (_, command) => callback(command)
      ipcRenderer.on(appCommandChannel, listener)
      return () => {
        ipcRenderer.removeListener(appCommandChannel, listener)
      }
    }
  },
  imageSources: {
    validateRemote: (url) => ipcRenderer.invoke('image-source:validate-remote', { url }),
    pickLocal: () => ipcRenderer.invoke('image-source:pick-local')
  },
  backgroundImages: {
    list: () => ipcRenderer.invoke('background-images:list'),
    getCurrent: () => ipcRenderer.invoke('background-images:get-current'),
    applyRemote: (url) => ipcRenderer.invoke('background-images:apply-remote', { url }),
    applyLocal: () => ipcRenderer.invoke('background-images:apply-local'),
    select: (id) => ipcRenderer.invoke('background-images:select', { id }),
    clearCurrent: () => ipcRenderer.invoke('background-images:clear-current'),
    remove: (id) => ipcRenderer.invoke('background-images:remove', { id }),
    migrateLegacy: (value) => ipcRenderer.invoke('background-images:migrate-legacy', { value })
  },
  discordPresence: {
    update: (payload) => ipcRenderer.invoke('discord-presence:update', payload),
    clear: () => ipcRenderer.invoke('discord-presence:clear'),
    getStatus: () => ipcRenderer.invoke('discord-presence:get-status')
  },
  appDiagnostics: {
    getStoragePaths: () => ipcRenderer.invoke('app:get-storage-paths'),
    getDatabaseStatus: () => ipcRenderer.invoke('app:get-database-status')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI

  window.api = api
}
