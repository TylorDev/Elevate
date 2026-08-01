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
import { getPrismaStatus, initializePrisma } from '../prisma.ts'
import { initializeWatchers } from '../utils/directoryWatcher.ts'
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
import { sendDatabaseStatus } from './rendererEvents.ts'

let dataIpcRegistered = false
let watchersStarted = false

function registerCoreIpcHandlers(
  retryDatabase: () => Promise<ReturnType<typeof getPrismaStatus>>
): void {
  ipcMain.on('ping', () => log.info('pong'))
  setupMainIpcHandlers(requestShutdown, { retryDatabase })
  setupImageSourceHandlers()
  setupDiscordPresenceHandlers()
  setupStoragePathHandlers()
}

function registerDataIpcHandlers(): void {
  if (dataIpcRegistered) return
  setupMusicHandlers()
  setupFilehandlers()
  setupArgvHandlers()
  setupPlaylistHandlers()
  setupPlaylistSaveExplorerHandlers()
  setupLikeSongHandlers()
  setupVisualizerHandlers()
  dataIpcRegistered = true
}

async function activateDatabaseServices(
  publishStatus = true
): Promise<ReturnType<typeof getPrismaStatus>> {
  try {
    await initializePrisma()
    registerDataIpcHandlers()

    if (!watchersStarted) {
      await initializeWatchers()
      watchersStarted = true
    }

    const status = getPrismaStatus()
    if (publishStatus) {
      sendDatabaseStatus('database:ready', status)
      if (status.recovery.resetPerformed) {
        sendDatabaseStatus('database:reset', status)
      }
    }
    return status
  } catch (error) {
    log.error('Prisma initialization failed:', error)
    const status = getPrismaStatus()
    if (publishStatus) {
      sendDatabaseStatus('database:error', status)
    }
    return status
  }
}

async function handleAppReady(): Promise<void> {
  console.time('startup:app-ready')
  app.setAppUserModelId('com.electron')
  log.info('App started, version:', process.versions.node)
  registerCoreIpcHandlers(() => activateDatabaseServices(true))
  createTray(requestShutdown)

  console.time('startup:prisma-init')
  const databaseStatus = await activateDatabaseServices(false)
  console.timeEnd('startup:prisma-init')

  console.time('startup:create-window')
  await createMainWindow()
  console.timeEnd('startup:create-window')

  if (databaseStatus.isReady) {
    sendDatabaseStatus('database:ready', databaseStatus)
    if (databaseStatus.recovery.resetPerformed) {
      sendDatabaseStatus('database:reset', databaseStatus)
    }
  } else {
    sendDatabaseStatus('database:error', databaseStatus)
  }

  startBackgroundServices(databaseStatus.isReady)
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
