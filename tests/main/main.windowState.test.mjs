import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { electronMock } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let context = null
let windowState = null

afterEach(async () => {
  windowState?.resetWindowStateStore()
  windowState = null
  if (context) {
    await context.cleanup()
    context = null
  }
})

async function setup() {
  context = await createRuntimeContext()
  windowState = await importFreshProject('src/main/main/windowState.ts')
  const { getStoragePaths } = await importFreshProject('src/main/ipc/storagePaths/index.ts')
  return getStoragePaths().windowStatePath
}

describe('main window state store', () => {
  it('returns null for missing, corrupt, and off-screen state', async () => {
    const statePath = await setup()
    await expect(windowState.loadWindowState()).resolves.toBeNull()

    await fs.promises.mkdir(path.dirname(statePath), { recursive: true })
    await fs.promises.writeFile(statePath, '{broken')
    await expect(windowState.loadWindowState()).resolves.toBeNull()

    await fs.promises.writeFile(statePath, JSON.stringify({ x: 5000, y: 5000 }))
    await expect(windowState.loadWindowState()).resolves.toBeNull()
  })

  it('serializes the latest scheduled bounds and flushes pending writes', async () => {
    const statePath = await setup()
    const mainWindow = new electronMock.BrowserWindow({ x: 10, y: 20, width: 800, height: 600 })

    windowState.scheduleWindowStateSave(mainWindow)
    mainWindow.bounds = { x: 30, y: 40, width: 1000, height: 700 }
    windowState.scheduleWindowStateSave(mainWindow)
    expect(fs.existsSync(statePath)).toBe(false)

    await windowState.flushWindowState(mainWindow)
    await expect(fs.promises.readFile(statePath, 'utf8').then(JSON.parse)).resolves.toEqual({
      x: 30,
      y: 40,
      width: 1000,
      height: 700,
      isMaximized: false,
      isMinimized: false
    })
  })
})
