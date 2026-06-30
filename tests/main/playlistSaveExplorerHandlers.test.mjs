import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getRegisteredIpcChannels, invokeIpc } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let context = null

afterEach(async () => {
  if (context) {
    await context.cleanup()
    context = null
  }
})

async function setupHandlers() {
  const { setupPlaylistSaveExplorerHandlers } = await importFreshProject(
    'src/main/ipc/playlistSaveExplorerHandlers/index.ts'
  )
  setupPlaylistSaveExplorerHandlers()
}

describe('playlist save explorer handlers', () => {
  it('registers both public IPC channels', async () => {
    context = await createRuntimeContext()
    await setupHandlers()

    expect(getRegisteredIpcChannels()).toEqual([
      'get-playlist-save-directory',
      'list-playlist-save-directory'
    ])
  })

  it('uses the first existing fallback directory', async () => {
    context = await createRuntimeContext()
    await setupHandlers()

    await expect(invokeIpc('get-playlist-save-directory', '')).resolves.toEqual({
      path: path.resolve(process.cwd())
    })

    const homePath = path.join(context.root, 'home')
    const documentsPath = path.join(context.root, 'documents')
    const musicPath = path.join(context.root, 'music')

    await fs.promises.mkdir(homePath)
    await expect(invokeIpc('get-playlist-save-directory', null)).resolves.toEqual({
      path: path.resolve(homePath)
    })

    await fs.promises.mkdir(documentsPath)
    await expect(invokeIpc('get-playlist-save-directory')).resolves.toEqual({
      path: path.resolve(documentsPath)
    })

    await fs.promises.mkdir(musicPath)
    await expect(invokeIpc('get-playlist-save-directory', 'missing-folder')).resolves.toEqual({
      path: path.resolve(musicPath)
    })
  })

  it('returns an explicitly selected existing directory', async () => {
    context = await createRuntimeContext()
    await setupHandlers()
    const selectedPath = path.join(context.root, 'selected')
    await fs.promises.mkdir(selectedPath)

    await expect(invokeIpc('get-playlist-save-directory', selectedPath)).resolves.toEqual({
      path: path.resolve(selectedPath)
    })
  })

  it('rejects empty, missing, and non-directory paths when listing', async () => {
    context = await createRuntimeContext()
    await setupHandlers()
    const filePath = path.join(context.root, 'playlist.m3u')
    await fs.promises.writeFile(filePath, '#EXTM3U')

    await expect(invokeIpc('list-playlist-save-directory', '')).rejects.toThrow(
      'Invalid folder path.'
    )
    await expect(
      invokeIpc('list-playlist-save-directory', path.join(context.root, 'missing'))
    ).rejects.toThrow('The selected folder does not exist.')
    await expect(invokeIpc('list-playlist-save-directory', filePath)).rejects.toThrow(
      'The selected path is not a directory.'
    )
  })

  it('lists sorted directories and only case-insensitive m3u files', async () => {
    context = await createRuntimeContext()
    await setupHandlers()
    const selectedPath = path.join(context.root, 'selected')
    await fs.promises.mkdir(selectedPath)
    await Promise.all([
      fs.promises.mkdir(path.join(selectedPath, 'Zulu')),
      fs.promises.mkdir(path.join(selectedPath, 'alpha')),
      fs.promises.mkdir(path.join(selectedPath, 'Bravo')),
      fs.promises.writeFile(path.join(selectedPath, 'Zulu.m3u'), '#EXTM3U'),
      fs.promises.writeFile(path.join(selectedPath, 'alpha.M3U'), '#EXTM3U'),
      fs.promises.writeFile(path.join(selectedPath, 'Bravo.m3u'), '#EXTM3U'),
      fs.promises.writeFile(path.join(selectedPath, 'ignored.txt'), 'ignored')
    ])

    const snapshot = await invokeIpc('list-playlist-save-directory', selectedPath)

    expect(snapshot).toEqual({
      currentPath: path.resolve(selectedPath),
      parentPath: path.dirname(path.resolve(selectedPath)),
      directories: [
        { name: 'alpha', path: path.join(selectedPath, 'alpha'), type: 'directory' },
        { name: 'Bravo', path: path.join(selectedPath, 'Bravo'), type: 'directory' },
        { name: 'Zulu', path: path.join(selectedPath, 'Zulu'), type: 'directory' }
      ],
      files: [
        { name: 'alpha.M3U', path: path.join(selectedPath, 'alpha.M3U'), type: 'file' },
        { name: 'Bravo.m3u', path: path.join(selectedPath, 'Bravo.m3u'), type: 'file' },
        { name: 'Zulu.m3u', path: path.join(selectedPath, 'Zulu.m3u'), type: 'file' }
      ]
    })
  })
})
