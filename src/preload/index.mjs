import { createRequire } from 'node:module'

// Custom APIs for renderer
const api = {}
const require = createRequire(import.meta.url)
const electron = require('electron')
const { contextBridge, ipcRenderer, webUtils } = electron
const windowStateChannel = 'window:state-changed'
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
    close: () => ipcRenderer.invoke('window:close'),
    getState: () => ipcRenderer.invoke('window:get-state'),
    onStateChange: (callback) => {
      const listener = (_, payload) => callback(payload)
      ipcRenderer.on(windowStateChannel, listener)
      return () => {
        ipcRenderer.removeListener(windowStateChannel, listener)
      }
    }
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
