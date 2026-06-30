import { afterEach, describe, expect, it } from 'vitest'
import { electronMock } from './helpers/electronMock.mjs'
import { importFreshProject } from './helpers/runtime.mjs'

let resetMainContext = null
let resetTaskbarState = null

afterEach(() => {
  resetTaskbarState?.()
  resetMainContext?.()
  resetTaskbarState = null
  resetMainContext = null
})

describe('main renderer and taskbar services', () => {
  it('guards destroyed windows when sending renderer events', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const { sendNotification } = await importFreshProject('src/main/main/rendererEvents.ts')
    resetMainContext = contextModule.resetMainContext
    const mainWindow = new electronMock.BrowserWindow()
    contextModule.setMainWindow(mainWindow)

    sendNotification('ready')
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('notification', 'ready')
    mainWindow.destroyed = true
    sendNotification('ignored')
    expect(mainWindow.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('builds Windows taskbar buttons and dispatches their commands', async () => {
    const contextModule = await importFreshProject('src/main/main/context.ts')
    const taskbarModule = await importFreshProject('src/main/main/taskbar.ts')
    resetMainContext = contextModule.resetMainContext
    resetTaskbarState = taskbarModule.resetTaskbarState
    const mainWindow = new electronMock.BrowserWindow()
    contextModule.setMainWindow(mainWindow)

    taskbarModule.updateTaskbarPlayerState({
      isPlaying: true,
      title: 'Song',
      artist: 'Artist',
      hasPrevious: true,
      hasNext: false,
      previewMode: 'cover-clip'
    })
    taskbarModule.updateTaskbarControls(mainWindow, 'win32')

    expect(mainWindow.setThumbnailToolTip).toHaveBeenCalledWith('Song - Artist')
    const buttons = mainWindow.setThumbarButtons.mock.calls.at(-1)[0]
    expect(buttons).toHaveLength(3)
    buttons[0].click()
    buttons[1].click()
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('app:command', 'previous-track')
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('app:command', 'toggle-playback')
  })
})
