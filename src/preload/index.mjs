import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
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
    })

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI

  window.api = api
}
