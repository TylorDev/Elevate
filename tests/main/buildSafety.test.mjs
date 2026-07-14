import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const PROJECT_ROOT = process.cwd()
let tempRoot = null

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

afterEach(async () => {
  if (tempRoot) {
    await fs.promises.rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
})

describe('build cleanup safety', () => {
  it('removes project artifacts without touching an installed database', async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'elevate-build-safety-'))
    const distPath = path.join(tempRoot, 'dist')
    const appDataPath = path.join(tempRoot, 'appData')
    const userDataPath = path.join(appDataPath, 'elevate')
    const databaseFiles = ['elevate.db', 'elevate.db-wal', 'elevate.db-shm'].map((fileName) =>
      path.join(userDataPath, fileName)
    )

    await fs.promises.mkdir(distPath, { recursive: true })
    await fs.promises.mkdir(userDataPath, { recursive: true })
    await fs.promises.writeFile(path.join(distPath, 'artifact.txt'), 'remove me')

    for (const [index, filePath] of databaseFiles.entries()) {
      await fs.promises.writeFile(filePath, `production-record-${index}`)
    }

    const before = databaseFiles.map((filePath) => ({
      hash: hashFile(filePath),
      mtimeMs: fs.statSync(filePath).mtimeMs
    }))

    execFileSync(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'clean-build.mjs')], {
      cwd: tempRoot,
      env: { ...process.env, APPDATA: appDataPath },
      stdio: 'pipe'
    })

    expect(fs.existsSync(distPath)).toBe(false)
    databaseFiles.forEach((filePath, index) => {
      expect(fs.existsSync(filePath)).toBe(true)
      expect(hashFile(filePath)).toBe(before[index].hash)
      expect(fs.statSync(filePath).mtimeMs).toBe(before[index].mtimeMs)
    })
  })
})
