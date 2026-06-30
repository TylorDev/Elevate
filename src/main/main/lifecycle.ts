import { app, BrowserWindow, globalShortcut } from 'electron'
import log from 'electron-log/main.js'
import { initDiscordPresence, shutdownDiscordPresence } from '../ipc/discordPresence/index.ts'
import { processAndDispatchLaunchArgs } from '../ipc/argv/index.ts'
import { disconnectPrisma, getPrismaStatus, initializePrisma } from '../prisma.ts'
import { initializeWatchers, stopAll as stopDirectoryWatchers } from '../utils/directoryWatcher.ts'
import { getMainWindow, mainContext } from './context.ts'
import { sendDatabaseStatus, sendNotification } from './rendererEvents.ts'
import { destroyTray } from './tray.ts'
import { flushWindowState } from './windowState.ts'

let shutdownPromise: Promise<void> | null = null

export function acquireSingleInstanceLock(): boolean {
  if (app.requestSingleInstanceLock()) return true
  app.quit()
  return false
}

async function runCleanupStep(label: string, cleanup: () => Promise<unknown>): Promise<void> {
  try {
    await cleanup()
  } catch (error) {
    log.error(`Error ${label}:`, error)
  }
}

export function requestShutdown(): Promise<void> {
  if (shutdownPromise) return shutdownPromise

  mainContext.hasShutdownStarted = true
  mainContext.isQuitting = true
  shutdownPromise = (async () => {
    await runCleanupStep('saving window state', () => flushWindowState())
    await runCleanupStep('stopping watchers', stopDirectoryWatchers)
    await runCleanupStep('shutting down Discord presence', shutdownDiscordPresence)
    if (getPrismaStatus().isReady) {
      await runCleanupStep('disconnecting Prisma', disconnectPrisma)
    }
    destroyTray()
    globalShortcut.unregisterAll()
    mainContext.shutdownComplete = true
    app.quit()
  })()

  return shutdownPromise
}

export function startBackgroundServices(): void {
  console.time('startup:prisma-init')
  void initializePrisma()
    .then(() => {
      console.timeEnd('startup:prisma-init')
      const status = getPrismaStatus()
      log.info('Prisma initialized successfully:', JSON.stringify(status))
      sendDatabaseStatus('database:ready', status)
    })
    .catch((error) => {
      console.timeEnd('startup:prisma-init')
      log.error('Prisma initialization failed:', error)
      sendDatabaseStatus('database:error', getPrismaStatus())
    })

  void initDiscordPresence().catch((error) =>
    log.error('Discord presence initialization failed:', error)
  )
  void initializeWatchers().catch((error) =>
    log.error('Error initializing directory watchers:', error)
  )

  console.info('[argv/main] initial process.argv', process.argv)
  void processAndDispatchLaunchArgs(process.argv.slice(1), {
    mainWindow: getMainWindow(),
    workingDirectory: process.cwd(),
    notifyRenderer: sendNotification,
    batchWindowMs: 0
  })
}

export function registerApplicationLifecycle(createWindow: () => Promise<BrowserWindow>): void {
  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    console.info('[argv/main] second-instance event', { commandLine, workingDirectory })
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    void processAndDispatchLaunchArgs(commandLine.slice(1), {
      mainWindow,
      workingDirectory,
      notifyRenderer: sendNotification
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error) => log.error('Failed to recreate main window:', error))
    }
  })

  app.on('render-process-gone', (_event, webContents, details) => {
    const webContentsId = webContents?.id ?? null
    const target =
      webContentsId === mainContext.mainRendererWebContentsId
        ? 'main-renderer'
        : 'devtools-or-secondary'
    const mainWindow = getMainWindow()
    log.error(
      'Render process gone:',
      JSON.stringify({
        reason: details?.reason,
        exitCode: details?.exitCode,
        webContentsId,
        target,
        devToolsOpened: Boolean(
          mainWindow?.webContents &&
          !mainWindow.webContents.isDestroyed() &&
          mainWindow.webContents.isDevToolsOpened()
        )
      })
    )
  })

  app.on('child-process-gone', (_event, details) => {
    log.error('Child process gone:', JSON.stringify(details))
  })

  app.on('will-quit', () => {
    destroyTray()
    globalShortcut.unregisterAll()
  })
}

export function resetLifecycleForTests(): void {
  shutdownPromise = null
}
