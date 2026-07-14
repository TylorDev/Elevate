import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Build cleanup must stay inside the project. User data under app.getPath('userData')
// belongs to installed applications and must never be touched by a build command.
const distDir = join(process.cwd(), 'dist')
if (existsSync(distDir)) {
  try {
    rmSync(distDir, { recursive: true, force: true })
    console.log(`[Clean] Removed dist directory: ${distDir}`)
  } catch (e) {
    console.error(`[Clean] Could not remove dist directory: ${e.message}`)
  }
}

console.log('[Clean] Build artifact cleanup finished. User data was not touched.')
