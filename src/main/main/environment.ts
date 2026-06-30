import { app } from 'electron'
import log from 'electron-log/main.js'
import { runNativeBindingDiagnostics } from '../ipc/nativeDiagnostics/index.ts'

let environmentConfigured = false

function hasCode(error: unknown): error is { code?: string } {
  return Boolean(error && typeof error === 'object')
}

export function configureMainEnvironment(): void {
  if (environmentConfigured) return
  environmentConfigured = true

  try {
    process.loadEnvFile()
  } catch (error) {
    if (!hasCode(error) || error.code !== 'ENOENT') {
      console.warn('Failed to load .env file for Electron main process:', error)
    }
  }

  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('in-process-gpu')
    app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess')
    if (process.env.ELECTRON_DISABLE_HARDWARE_ACCELERATION?.trim() === '1') {
      app.disableHardwareAcceleration()
    }
  }

  log.transports.file.level = 'info'
  log.transports.console.level = 'debug'
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}'
  log.initialize()
  runNativeBindingDiagnostics(log, app)

  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error.message)
    log.error('Stack:', error.stack)
  })
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', promise)
    log.error('Reason:', reason)
  })
}

export function resetMainEnvironmentForTests(): void {
  environmentConfigured = false
}
