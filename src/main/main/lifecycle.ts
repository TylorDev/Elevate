import { app, BrowserWindow, globalShortcut } from 'electron'
import log from 'electron-log/main.js'
import { initDiscordPresence, shutdownDiscordPresence } from '../ipc/discordPresence/index.ts'
import { processAndDispatchLaunchArgs } from '../ipc/argv/index.ts'
import { disconnectPrisma, getPrismaStatus } from '../prisma.ts'
import { stopAll as stopDirectoryWatchers } from '../utils/directoryWatcher.ts'
import { getMainWindow, mainContext } from './context.ts'
import { sendNotification } from './rendererEvents.ts'
import { destroyTray } from './tray.ts'
import { restoreMainWindow } from './windowManager.ts'
import { flushWindowState } from './windowState.ts'
import {
  createPerformanceDiagnostic,
  shutdownPerformanceDiagnostics,
  writePerformanceDiagnostic
} from '../diagnostics/performanceDiagnostics.ts'
import { stopPerformanceTrace } from '../diagnostics/performanceTrace.ts'

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
    await runCleanupStep('saving performance trace', () => stopPerformanceTrace('app-shutdown'))
    await runCleanupStep('stopping watchers', stopDirectoryWatchers)
    await runCleanupStep('shutting down Discord presence', shutdownDiscordPresence)
    if (getPrismaStatus().isReady) {
      await runCleanupStep('disconnecting Prisma', disconnectPrisma)
    }
    destroyTray()
    globalShortcut.unregisterAll()
    shutdownPerformanceDiagnostics()
    mainContext.shutdownComplete = true
    app.quit()
  })()

  return shutdownPromise
}

export function startBackgroundServices(databaseReady: boolean): void {
  void initDiscordPresence().catch((error) =>
    log.error('Discord presence initialization failed:', error)
  )

  console.info('[argv/main] initial process.argv', process.argv)
  if (databaseReady) {
    void processAndDispatchLaunchArgs(process.argv.slice(1), {
      mainWindow: getMainWindow(),
      workingDirectory: process.cwd(),
      notifyRenderer: sendNotification,
      batchWindowMs: 0
    })
  }
}

export function registerApplicationLifecycle(createWindow: () => Promise<BrowserWindow>): void {
  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    console.info('[argv/main] second-instance event', { commandLine, workingDirectory })
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      restoreMainWindow()
    }
    if (getPrismaStatus().isReady) {
      void processAndDispatchLaunchArgs(commandLine.slice(1), {
        mainWindow,
        workingDirectory,
        notifyRenderer: sendNotification
      })
    }
  })

  app.on('activate', () => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      restoreMainWindow()
      return
    }

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
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('renderer.render-process-gone', {
        level: 'error',
        processType: 'renderer',
        details: {
          reason: details?.reason || null,
          exitCode: details?.exitCode ?? null,
          webContentsId,
          target
        }
      })
    )
  })

  app.on('child-process-gone', (_event, details) => {
    log.error('Child process gone:', JSON.stringify(details))
    writePerformanceDiagnostic(
      createPerformanceDiagnostic('process.child-gone', {
        level: 'error',
        pid: null,
        details: { ...details }
      })
    )
  })

  app.on('will-quit', () => {
    destroyTray()
    globalShortcut.unregisterAll()
  })
}

export function resetLifecycleForTests(): void {
  shutdownPromise = null
}
