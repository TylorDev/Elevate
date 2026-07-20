import { afterEach, describe, expect, it, vi } from 'vitest'

import { visualizerService } from '../../../src/ElevateViz/services/visualizerService.ts'

afterEach(() => vi.unstubAllGlobals())

describe('ElevateViz IPC service', () => {
  it('returns successful state from the existing visualizer IPC contract', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true, state: { presetLists: [] } })
    vi.stubGlobal('window', { electron: { ipcRenderer: { invoke } } })

    await expect(visualizerService.loadVisualizerState()).resolves.toMatchObject({ success: true })
    expect(invoke).toHaveBeenCalledWith('visualizer:load-state', undefined)
  })

  it('rejects missing and failed IPC responses with a stable error', async () => {
    vi.stubGlobal('window', { electron: { ipcRenderer: { invoke: vi.fn().mockResolvedValue(null) } } })
    await expect(visualizerService.loadVisualizerState()).rejects.toThrow('Visualizer IPC failed')

    window.electron.ipcRenderer.invoke.mockResolvedValue({ success: false, error: 'database offline' })
    await expect(visualizerService.loadVisualizerState()).rejects.toThrow('database offline')
  })
})
