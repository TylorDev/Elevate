import { afterEach, describe, expect, it, vi } from 'vitest'
import { electronMock, getRegisteredIpcChannels, invokeIpc } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let context = null
let resetMainContext = null
let resetWindowStateStore = null

afterEach(async () => {
  resetWindowStateStore?.()
  resetMainContext?.()
  resetMainContext = null
  resetWindowStateStore = null
  if (context) {
    await context.cleanup()
    context = null
  }
})

describe('main IPC handlers', () => {
  it('registers typed handlers and validates window payloads', async () => {
    context = await createRuntimeContext()
    const mainContextModule = await importFreshProject('src/main/main/context.ts')
    const { setupMainIpcHandlers } = await importFreshProject('src/main/main/ipc.ts')
    const windowStateModule = await importFreshProject('src/main/main/windowState.ts')
    resetMainContext = mainContextModule.resetMainContext
    resetWindowStateStore = windowStateModule.resetWindowStateStore

    const mainWindow = new electronMock.BrowserWindow({ x: 0, y: 0, width: 800, height: 600 })
    mainContextModule.setMainWindow(mainWindow)
    const requestShutdown = vi.fn(() => Promise.resolve())
    setupMainIpcHandlers(requestShutdown)

    expect(getRegisteredIpcChannels()).toEqual([
      'window:minimize',
      'window:toggle-maximize',
      'window:close',
      'window:open-external',
      'window:restore',
      'window:quit',
      'window:get-state',
      'app:get-database-status',
      'window:toggle-always-on-top',
      'window:set-minimum-size',
      'window:apply-grid-preset',
      'window:update-taskbar-player-state'
    ])

    await invokeIpc('window:set-minimum-size', null)
    await invokeIpc('window:set-minimum-size', { width: -1, height: 400 })
    expect(mainWindow.setMinimumSize).not.toHaveBeenCalled()
    await invokeIpc('window:set-minimum-size', { width: 500, height: 400 })
    expect(mainWindow.setMinimumSize).toHaveBeenCalledWith(500, 400)

    await expect(invokeIpc('window:open-external', ' ')).resolves.toBe(false)
    await expect(invokeIpc('window:open-external', 'https://example.test')).resolves.toBe(true)
    expect(electronMock.shell.openExternal).toHaveBeenCalledWith('https://example.test')

    await invokeIpc('window:quit')
    expect(requestShutdown).toHaveBeenCalledOnce()
  })

  it('applies valid grid selections and rejects invalid ones', async () => {
    context = await createRuntimeContext()
    const mainContextModule = await importFreshProject('src/main/main/context.ts')
    const { setupMainIpcHandlers } = await importFreshProject('src/main/main/ipc.ts')
    const windowStateModule = await importFreshProject('src/main/main/windowState.ts')
    resetMainContext = mainContextModule.resetMainContext
    resetWindowStateStore = windowStateModule.resetWindowStateStore

    const mainWindow = new electronMock.BrowserWindow({ x: 0, y: 0, width: 800, height: 600 })
    mainContextModule.setMainWindow(mainWindow)
    electronMock.screen.getDisplayMatching.mockReturnValue({
      id: 9,
      bounds: { x: 10, y: 20, width: 1001, height: 801 },
      workArea: { x: 10, y: 20, width: 1001, height: 801 }
    })
    setupMainIpcHandlers(() => Promise.resolve())

    await expect(invokeIpc('window:apply-grid-preset', { cells: [] })).resolves.toEqual({
      success: false,
      error: 'At least one valid grid cell is required.'
    })
    await expect(
      invokeIpc('window:apply-grid-preset', { cells: ['bottom-right'] })
    ).resolves.toEqual({
      success: true,
      bounds: { x: 510, y: 420, width: 501, height: 401 },
      displayId: 9
    })
    expect(mainWindow.setBounds).toHaveBeenCalledWith({
      x: 510,
      y: 420,
      width: 501,
      height: 401
    })
  })
})
