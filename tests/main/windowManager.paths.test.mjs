import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { electronMock } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let runtime = null
let resetMainContext = null
let resetWindowStateStore = null
const originalRendererUrl = process.env.ELECTRON_RENDERER_URL

afterEach(async () => {
  if (originalRendererUrl === undefined) {
    delete process.env.ELECTRON_RENDERER_URL
  } else {
    process.env.ELECTRON_RENDERER_URL = originalRendererUrl
  }
  resetWindowStateStore?.()
  resetMainContext?.()
  resetWindowStateStore = null
  resetMainContext = null
  if (runtime) {
    await runtime.cleanup()
    runtime = null
  }
})

async function createWindow({ appPath, isPackaged, rendererUrl }) {
  runtime = await createRuntimeContext()
  electronMock.app.getAppPath.mockReturnValue(appPath)
  electronMock.app.isPackaged = isPackaged
  if (rendererUrl === undefined) {
    delete process.env.ELECTRON_RENDERER_URL
  } else {
    process.env.ELECTRON_RENDERER_URL = rendererUrl
  }

  const contextModule = await importFreshProject('src/main/main/context.ts')
  const windowStateModule = await importFreshProject('src/main/main/windowState.ts')
  const windowManager = await importFreshProject('src/main/main/windowManager.ts')
  resetMainContext = contextModule.resetMainContext
  resetWindowStateStore = windowStateModule.resetWindowStateStore

  return windowManager.createMainWindow()
}

describe('main window entry paths', () => {
  it('resolves preload and renderer files from normal and ASAR application roots', async () => {
    const { resolveWindowEntryPaths } = await importFreshProject('src/main/utils/windowAssets.ts')

    expect(resolveWindowEntryPaths('C:\\workspace\\Elevate')).toEqual({
      preloadPath: path.join('C:\\workspace\\Elevate', 'out', 'preload', 'index.mjs'),
      rendererPath: path.join('C:\\workspace\\Elevate', 'out', 'renderer', 'index.html')
    })
    expect(resolveWindowEntryPaths('C:\\Program Files\\Elevate\\resources\\app.asar')).toEqual({
      preloadPath: path.join(
        'C:\\Program Files\\Elevate\\resources\\app.asar',
        'out',
        'preload',
        'index.mjs'
      ),
      rendererPath: path.join(
        'C:\\Program Files\\Elevate\\resources\\app.asar',
        'out',
        'renderer',
        'index.html'
      )
    })
  })

  it('loads packaged preload and renderer files from app.getAppPath()', async () => {
    const appPath = 'C:\\Program Files\\Elevate\\resources\\app.asar'
    const mainWindow = await createWindow({ appPath, isPackaged: true })

    expect(mainWindow.options.webPreferences.preload).toBe(
      path.join(appPath, 'out', 'preload', 'index.mjs')
    )
    expect(mainWindow.loadFile).toHaveBeenCalledWith(
      path.join(appPath, 'out', 'renderer', 'index.html')
    )
    expect(mainWindow.loadURL).not.toHaveBeenCalled()
  })

  it('keeps the development renderer URL while using the stable preload path', async () => {
    const appPath = 'D:\\code\\Elevate'
    const rendererUrl = 'http://127.0.0.1:5173'
    const mainWindow = await createWindow({ appPath, isPackaged: false, rendererUrl })

    expect(mainWindow.options.webPreferences.preload).toBe(
      path.join(appPath, 'out', 'preload', 'index.mjs')
    )
    expect(mainWindow.loadURL).toHaveBeenCalledWith(rendererUrl)
    expect(mainWindow.loadFile).not.toHaveBeenCalled()
  })
})
