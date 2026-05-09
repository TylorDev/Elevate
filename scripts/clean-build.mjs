import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// 1. Clean the dist folder
const distDir = join(process.cwd(), 'dist')
if (existsSync(distDir)) {
  try {
    rmSync(distDir, { recursive: true, force: true })
    console.log(`[Clean] Removed dist directory: ${distDir}`)
  } catch (e) {
    console.error(`[Clean] Could not remove dist directory: ${e.message}`)
  }
}

// 2. Clean the production database from AppData
// This ensures that when testing the packaged app, it copies the fresh template.db
const appData = process.env.APPDATA || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : join(homedir(), '.config'))
const elevateDataDir = join(appData, 'elevate')

const dbFiles = ['elevate.db', 'elevate.db-shm', 'elevate.db-wal']
dbFiles.forEach(file => {
  const fileToRemove = join(elevateDataDir, file)
  if (existsSync(fileToRemove)) {
    try {
      rmSync(fileToRemove, { force: true })
      console.log(`[Clean] Removed old production database file: ${fileToRemove}`)
    } catch (e) {
      console.error(`[Clean] Could not remove ${fileToRemove}: ${e.message}. Is the app still running?`)
    }
  }
})

console.log('[Clean] Clean up finished.')
