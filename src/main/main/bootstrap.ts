import { app, ipcMain } from 'electron'
import log from 'electron-log/main.js'
import { setupArgvHandlers } from '../ipc/argv/index.ts'
import { setupDiscordPresenceHandlers } from '../ipc/discordPresence/index.ts'
import { setupFilehandlers } from '../ipc/filehandlers/index.ts'
import { setupImageSourceHandlers } from '../ipc/imageSourceHandlers/index.ts'
import { setupLikeSongHandlers, setupMusicHandlers } from '../ipc/likehandlers/index.ts'
import { setupPlaylistHandlers } from '../ipc/playlistHandlers/index.ts'
import { setupPlaylistSaveExplorerHandlers } from '../ipc/playlistSaveExplorerHandlers/index.ts'
import { setupStoragePathHandlers } from '../ipc/storagePaths/index.ts'
import { setupVisualizerHandlers } from '../ipc/visualizerHandlers/index.ts'
import { configureMainEnvironment } from './environment.ts'
import { setupMainIpcHandlers } from './ipc.ts'
import {
  acquireSingleInstanceLock,
  registerApplicationLifecycle,
  requestShutdown,
  startBackgroundServices
} from './lifecycle.ts'
import { createTray } from './tray.ts'
import { createMainWindow } from './windowManager.ts'

function registerIpcHandlers(): void {
  ipcMain.on('ping', () => log.info('pong'))
  setupMainIpcHandlers(requestShutdown)
  setupMusicHandlers()
  setupFilehandlers()
  setupArgvHandlers()
  setupPlaylistHandlers()
  setupPlaylistSaveExplorerHandlers()
  setupLikeSongHandlers()
  setupImageSourceHandlers()
  setupVisualizerHandlers()
  setupDiscordPresenceHandlers()
  setupStoragePathHandlers()
}

async function handleAppReady(): Promise<void> {
  console.time('startup:app-ready')
  app.setAppUserModelId('com.electron')
  log.info('App started, version:', process.versions.node)
  registerIpcHandlers()

  console.time('startup:create-window')
  createTray(requestShutdown)
  await createMainWindow()
  console.timeEnd('startup:create-window')

  startBackgroundServices()
  console.timeEnd('startup:app-ready')
}

export function startApplication(): void {
  configureMainEnvironment()
  if (!acquireSingleInstanceLock()) return

  registerApplicationLifecycle(createMainWindow)
  void app
    .whenReady()
    .then(handleAppReady)
    .catch((error) => {
      log.error('Application startup failed:', error)
      void requestShutdown()
    })
}
