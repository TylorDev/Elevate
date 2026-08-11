import { app, ipcMain } from 'electron'
import log from 'electron-log/main.js'
import { setupArgvHandlers } from '../ipc/argv/index.ts'
import { setupDiscordPresenceHandlers } from '../ipc/discordPresence/index.ts'
import { setupFilehandlers } from '../ipc/filehandlers/index.ts'
import { setupImageSourceHandlers } from '../ipc/imageSourceHandlers/index.ts'
import { setupLikeSongHandlers, setupMusicHandlers } from '../ipc/likehandlers/index.ts'
import { setupPlaylistHandlers } from '../ipc/playlistHandlers/index.ts'
import { setupPlaylistSaveExplorerHandlers } from '../ipc/playlistSaveExplorerHandlers/index.ts'
import { setupPlaybackDiagnosticsHandlers } from '../ipc/playbackDiagnostics/index.ts'
import { setupPerformanceDiagnosticsHandlers } from '../ipc/performanceDiagnostics/index.ts'
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
import { initializePlaybackDiagnostics } from '../diagnostics/playbackDiagnostics.ts'
import {
  beginPerformanceOperation,
  initializePerformanceDiagnostics,
  recordStartupMilestone
} from '../diagnostics/performanceDiagnostics.ts'
import { initializePerformanceTrace } from '../diagnostics/performanceTrace.ts'

let dataIpcRegistered = false
let watchersStarted = false
const processStartedAt = Date.now()

function registerCoreIpcHandlers(
  retryDatabase: () => Promise<ReturnType<typeof getPrismaStatus>>
): void {
  ipcMain.on('ping', () => log.info('pong'))
  setupMainIpcHandlers(requestShutdown, { retryDatabase })
  setupImageSourceHandlers()
  setupDiscordPresenceHandlers()
  setupStoragePathHandlers()
  setupPlaybackDiagnosticsHandlers()
  setupPerformanceDiagnosticsHandlers()
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
  const databaseOperation = beginPerformanceOperation('startup.database-services', {
    always: true,
    details: { publishStatus }
  })
  try {
    const prismaOperation = beginPerformanceOperation('startup.prisma-initialize', {
      always: true,
      parentOperationId: databaseOperation.operationId
    })
    try {
      await initializePrisma()
      prismaOperation.end({ details: { status: getPrismaStatus() } })
    } catch (error) {
      prismaOperation.end({ error })
      throw error
    }

    const ipcOperation = beginPerformanceOperation('startup.data-ipc-registration', {
      always: true,
      parentOperationId: databaseOperation.operationId
    })
    const wasRegistered = dataIpcRegistered
    registerDataIpcHandlers()
    ipcOperation.end({ details: { alreadyRegistered: wasRegistered } })

    if (!watchersStarted) {
      const watchersOperation = beginPerformanceOperation('startup.watchers-initialize', {
        always: true,
        parentOperationId: databaseOperation.operationId
      })
      try {
        await initializeWatchers()
        watchersOperation.end()
      } catch (error) {
        watchersOperation.end({ error })
        throw error
      }
      watchersStarted = true
    }

    const status = getPrismaStatus()
    if (publishStatus) {
      sendDatabaseStatus('database:ready', status)
      if (status.recovery.resetPerformed) {
        sendDatabaseStatus('database:reset', status)
      }
    }
    databaseOperation.end({ details: { ready: status.isReady } })
    return status
  } catch (error) {
    databaseOperation.end({ error })
    log.error('Prisma initialization failed:', error)
    const status = getPrismaStatus()
    if (publishStatus) {
      sendDatabaseStatus('database:error', status)
    }
    return status
  }
}

async function handleAppReady(): Promise<void> {
  app.setAppUserModelId('com.tylordev.elevate')
  initializePlaybackDiagnostics()
  initializePerformanceDiagnostics()
  recordStartupMilestone('app.ready', { elapsedSinceProcessStartMs: Date.now() - processStartedAt })
  await initializePerformanceTrace()
  log.info('App started, version:', process.versions.node)
  const coreOperation = beginPerformanceOperation('startup.core-services', { always: true })
  registerCoreIpcHandlers(() => activateDatabaseServices(true))
  createTray(requestShutdown)
  coreOperation.end()

  const databaseStatus = await activateDatabaseServices(false)

  const windowOperation = beginPerformanceOperation('startup.create-main-window', { always: true })
  try {
    await createMainWindow()
    windowOperation.end()
  } catch (error) {
    windowOperation.end({ error })
    throw error
  }

  if (databaseStatus.isReady) {
    sendDatabaseStatus('database:ready', databaseStatus)
    if (databaseStatus.recovery.resetPerformed) {
      sendDatabaseStatus('database:reset', databaseStatus)
    }
  } else {
    sendDatabaseStatus('database:error', databaseStatus)
  }

  startBackgroundServices(databaseStatus.isReady)
  recordStartupMilestone('startup.main-complete', {
    elapsedSinceProcessStartMs: Date.now() - processStartedAt,
    databaseReady: databaseStatus.isReady
  })
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
