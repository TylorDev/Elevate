import { createRequire } from 'node:module'

// Custom APIs for renderer
const api = {}
const require = createRequire(import.meta.url)
const electron = require('electron')
const { contextBridge, ipcRenderer } = electron
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
