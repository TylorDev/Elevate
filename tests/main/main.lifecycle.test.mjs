import { afterEach, describe, expect, it } from 'vitest'
import { electronMock } from './helpers/electronMock.mjs'
import { importFreshProject } from './helpers/runtime.mjs'

let resetMainContext = null
let resetLifecycleForTests = null

afterEach(() => {
  resetLifecycleForTests?.()
  resetMainContext?.()
  resetLifecycleForTests = null
  resetMainContext = null
})

describe('main application lifecycle', () => {
  it('quits immediately when another application instance owns the lock', async () => {
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    electronMock.app.requestSingleInstanceLock.mockReturnValueOnce(false)

    expect(lifecycleModule.acquireSingleInstanceLock()).toBe(false)
    expect(electronMock.app.quit).toHaveBeenCalledOnce()
  })

  it('logs renderer process failures without referencing stale DevTools state', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    const mainWindow = new electronMock.BrowserWindow()
    contextModule.setMainWindow(mainWindow)
    lifecycleModule.registerApplicationLifecycle(async () => new electronMock.BrowserWindow())

    expect(() => {
      electronMock.app.emit('render-process-gone', {}, mainWindow.webContents, {
        reason: 'crashed',
        exitCode: 1
      })
    }).not.toThrow()
  })

  it('shares one idempotent shutdown and cleans native resources once', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests

    const firstShutdown = lifecycleModule.requestShutdown()
    const secondShutdown = lifecycleModule.requestShutdown()
    expect(secondShutdown).toBe(firstShutdown)
    await firstShutdown

    expect(contextModule.mainContext).toMatchObject({
      isQuitting: true,
      hasShutdownStarted: true,
      shutdownComplete: true
    })
    expect(electronMock.globalShortcut.unregisterAll).toHaveBeenCalledOnce()
    expect(electronMock.app.quit).toHaveBeenCalledOnce()
  })
})
