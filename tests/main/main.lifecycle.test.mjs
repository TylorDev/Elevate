import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('shows and focuses the hidden main window when a second instance starts', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    const mainWindow = new electronMock.BrowserWindow()
    const createWindow = vi.fn(async () => new electronMock.BrowserWindow())
    contextModule.setMainWindow(mainWindow)
    mainWindow.hide()
    lifecycleModule.registerApplicationLifecycle(createWindow)

    electronMock.app.emit('second-instance', {}, ['Elevate.exe'], process.cwd())

    expect(mainWindow.show).toHaveBeenCalledOnce()
    expect(mainWindow.focus).toHaveBeenCalledOnce()
    expect(createWindow).not.toHaveBeenCalled()
  })

  it('restores a minimized main window when a second instance starts', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    const mainWindow = new electronMock.BrowserWindow()
    contextModule.setMainWindow(mainWindow)
    mainWindow.isMinimized.mockReturnValue(true)
    lifecycleModule.registerApplicationLifecycle(async () => new electronMock.BrowserWindow())

    electronMock.app.emit('second-instance', {}, ['Elevate.exe'], process.cwd())

    expect(mainWindow.restore).toHaveBeenCalledOnce()
    expect(mainWindow.focus).toHaveBeenCalledOnce()
  })

  it('restores an existing hidden main window when the application is activated', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    const mainWindow = new electronMock.BrowserWindow()
    const createWindow = vi.fn(async () => new electronMock.BrowserWindow())
    contextModule.setMainWindow(mainWindow)
    mainWindow.hide()
    lifecycleModule.registerApplicationLifecycle(createWindow)

    electronMock.app.emit('activate')

    expect(mainWindow.show).toHaveBeenCalledOnce()
    expect(mainWindow.focus).toHaveBeenCalledOnce()
    expect(createWindow).not.toHaveBeenCalled()
  })

  it('creates a main window on activation when no window exists', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const lifecycleModule = await importFreshProject('src/main/main/lifecycle.ts')
    resetMainContext = contextModule.resetMainContext
    resetLifecycleForTests = lifecycleModule.resetLifecycleForTests
    const createWindow = vi.fn(async () => new electronMock.BrowserWindow())
    lifecycleModule.registerApplicationLifecycle(createWindow)

    electronMock.app.emit('activate')

    expect(createWindow).toHaveBeenCalledOnce()
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
