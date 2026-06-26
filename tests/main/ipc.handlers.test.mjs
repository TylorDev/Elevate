import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRegisteredIpcChannels,
  invokeIpc,
  setOpenDialogResult
} from './helpers/electronMock.mjs'
import { createPrismaTestContext, createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let context = null

afterEach(async () => {
  if (context) {
    await context.cleanup()
    context = null
  }
})

describe('main IPC handlers', () => {
  it('manages visualizer settings, favorites, lists, associations, and stale association pruning', async () => {
    context = await createPrismaTestContext()
    const { setupVisualizerHandlers } = await importFreshProject('src/main/ipc/visualizerHandlers.ts')
    setupVisualizerHandlers()

    const initial = await invokeIpc('visualizer:load-state')
    expect(initial).toMatchObject({
      success: true,
      state: {
        cycleDurationMs: 6000,
        presetSource: { mode: 'all', listId: null },
        favorites: [],
        presetLists: [],
        sourceAssociations: {}
      }
    })

    const favorite = await invokeIpc('visualizer:toggle-favorite', 'milkdrop preset')
    const listResult = await invokeIpc('visualizer:create-list', 'Road')
    const listId = listResult.state.presetLists[0].id
    await invokeIpc('visualizer:toggle-preset-in-list', { listId, presetName: 'milkdrop preset' })
    await invokeIpc('visualizer:update-settings', {
      cycleDurationMs: 750,
      presetSource: { mode: 'list', listId }
    })
    await invokeIpc('visualizer:associate-source', {
      source: { type: 'playlist', id: 'mix.m3u' },
      listId
    })
    await invokeIpc('visualizer:associate-source', {
      source: { type: 'directory', id: 'C:/music' },
      listId
    })
    const pruned = await invokeIpc('visualizer:prune-source-associations', ['playlist:mix.m3u'])

    expect(favorite.state.favorites).toEqual(['milkdrop preset'])
    expect(pruned.state).toMatchObject({
      cycleDurationMs: 1000,
      presetSource: { mode: 'list', listId },
      sourceAssociations: {
        'playlist:mix.m3u': listId
      }
    })
    expect(pruned.state.sourceAssociations['directory:C:/music']).toBeUndefined()
    expect(pruned.state.presetLists[0].presetNames).toEqual(['milkdrop preset'])
  })

  it('stores local background images and validates remote image URLs through IPC', async () => {
    context = await createRuntimeContext()
    const imagePath = path.join(context.root, 'background.png')
    await fs.promises.writeFile(imagePath, Buffer.from('fake-png'))
    setOpenDialogResult({ canceled: false, filePaths: [imagePath] })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => Buffer.from('remote-png')
      }))
    )

    const { setupImageSourceHandlers } = await importFreshProject('src/main/ipc/imageSourceHandlers/index.ts')
    setupImageSourceHandlers()

    const remoteValidation = await invokeIpc('image-source:validate-remote', {
      url: 'https://example.test/background.png'
    })
    const applied = await invokeIpc('background-images:apply-local')
    const assetExistsAfterApply = fs.existsSync(applied.current.resolvedAssetPath)
    const listed = await invokeIpc('background-images:list')
    const cleared = await invokeIpc('background-images:clear-current')
    const removed = await invokeIpc('background-images:remove', { id: applied.current.id })

    expect(remoteValidation).toMatchObject({
      success: true,
      mimeType: 'image/png'
    })
    expect(applied).toMatchObject({
      success: true,
      current: {
        sourceType: 'local',
        sourceValue: imagePath,
        status: 'ready'
      }
    })
    expect(assetExistsAfterApply).toBe(true)
    expect(listed.items).toHaveLength(1)
    expect(cleared.current).toBeNull()
    expect(removed.items).toHaveLength(0)
    expect(fs.existsSync(applied.current.resolvedAssetPath)).toBe(false)
  })

  it('registers playlist and file handler channel surfaces without opening Electron windows', async () => {
    context = await createRuntimeContext()
    vi.doMock('../../src/main/index.ts', () => ({
      sendNotification: vi.fn()
    }))

    const playlists = await importFreshProject('src/main/ipc/playlistHandlers/index.ts')
    const files = await importFreshProject('src/main/ipc/filehandlers/index.ts')
    playlists.setupPlaylistHandlers()
    files.setupFilehandlers()

    expect(getRegisteredIpcChannels()).toEqual(
      expect.arrayContaining([
        'load-list',
        'get-list',
        'save-m3u',
        'get-playlists',
        'add-directory',
        'get-all-audio-files',
        'collection:get-overview',
        'search-directories-page'
      ])
    )
  })
})
