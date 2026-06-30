import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { electronMock, getRegisteredIpcChannels, invokeIpc } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let runtime = null

afterEach(async () => {
  if (runtime) {
    await runtime.cleanup()
    runtime = null
  }
})

describe('main argv processing', () => {
  it('normalizes existing launch entries while preserving order and removing invalid duplicates', async () => {
    runtime = await createRuntimeContext()
    const { normalizeLaunchEntries } = await importFreshProject('src/main/ipc/argv/entries.ts')
    const audioPath = path.join(runtime.root, 'Track.MP3')
    const videoPath = path.join(runtime.root, 'Clip.mp4')
    const playlistPath = path.join(runtime.root, 'Queue.M3U')
    const unsupportedPath = path.join(runtime.root, 'cover.jpg')
    const directoryPath = path.join(runtime.root, 'album')

    await Promise.all([
      fs.promises.writeFile(audioPath, Buffer.from('audio')),
      fs.promises.writeFile(videoPath, Buffer.from('video')),
      fs.promises.writeFile(playlistPath, '#EXTM3U\n'),
      fs.promises.writeFile(unsupportedPath, Buffer.from('image')),
      fs.promises.mkdir(directoryPath)
    ])

    const entries = normalizeLaunchEntries(
      [
        '--flag',
        'missing.mp3',
        `"${audioPath}"`,
        audioPath,
        videoPath,
        directoryPath,
        playlistPath,
        unsupportedPath,
        runtime.root,
        process.cwd()
      ],
      runtime.root
    )

    expect(entries).toEqual([
      { type: 'file', path: audioPath },
      { type: 'file', path: videoPath },
      { type: 'directory', path: directoryPath },
      { type: 'playlist', path: playlistPath }
    ])
  })

  it('builds stable payload kinds and deduplicates entries merged by the batching layer', async () => {
    runtime = await createRuntimeContext()
    const shared = await importFreshProject('src/main/ipc/argv/shared.ts')
    const { processLaunchEntries } = await importFreshProject('src/main/ipc/argv/processing.ts')
    const { mergeLaunchRequestEntries } = await importFreshProject('src/main/ipc/argv/dispatch.ts')
    const notifyRenderer = () => {}
    const invalidateDirectoryCache = () => {}
    const firstEntry = { type: 'file', path: 'C:/music/one.mp3' }
    const secondEntry = { type: 'directory', path: 'C:/music/album' }

    expect(shared.createEmptyPayload()).toEqual({
      kind: 'empty',
      files: [],
      directories: [],
      songs: [],
      hasDirectories: false,
      queueName: '',
      startIndex: 0
    })
    expect(shared.getPayloadKind([], [])).toBe('empty')
    expect(shared.getPayloadKind([firstEntry.path], [])).toBe('single-file')
    expect(shared.getPayloadKind([firstEntry.path, 'C:/music/two.mp3'], [])).toBe('multi-file')
    expect(shared.getPayloadKind([], [secondEntry.path])).toBe('directory')
    expect(shared.getPayloadKind([firstEntry.path], [secondEntry.path])).toBe('mixed')

    expect(
      mergeLaunchRequestEntries([
        { entries: [firstEntry], notifyRenderer, invalidateDirectoryCache },
        { entries: [firstEntry, secondEntry], notifyRenderer, invalidateDirectoryCache }
      ])
    ).toEqual([firstEntry, secondEntry])

    await expect(
      processLaunchEntries([
        { type: 'playlist', path: 'C:/music/one.m3u' },
        { type: 'playlist', path: 'C:/music/two.m3u' }
      ])
    ).resolves.toEqual({
      kind: 'empty',
      files: [],
      directories: [],
      songs: [],
      hasDirectories: false,
      queueName: 'Argv Queue',
      startIndex: 0
    })
  })

  it('queues payloads until the renderer is ready and then sends subsequent payloads immediately', async () => {
    runtime = await createRuntimeContext()
    const argv = await importFreshProject('src/main/ipc/argv/index.ts')
    const { dispatchPayloadToRenderer } = await importFreshProject('src/main/ipc/argv/dispatch.ts')
    const payload = {
      kind: 'single-file',
      files: ['C:/music/song.mp3'],
      directories: [],
      songs: [{ filePath: 'C:/music/song.mp3', fileName: 'song.mp3' }],
      hasDirectories: false,
      queueName: 'C:/music/song.mp3',
      startIndex: 0
    }

    argv.setupArgvHandlers()
    expect(getRegisteredIpcChannels()).toEqual(['get-argv-files', 'process-dropped-paths'])
    await expect(invokeIpc('process-dropped-paths', [])).resolves.toEqual({
      kind: 'empty',
      files: [],
      directories: [],
      songs: [],
      hasDirectories: false,
      queueName: '',
      startIndex: 0
    })

    await dispatchPayloadToRenderer(payload, null)
    await expect(invokeIpc('get-argv-files')).resolves.toEqual([payload])
    await expect(invokeIpc('get-argv-files')).resolves.toEqual([])

    const mainWindow = new electronMock.BrowserWindow()
    await dispatchPayloadToRenderer(payload, mainWindow)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('argv-files-processed', payload)

    argv.markLaunchWindowPending()
    await dispatchPayloadToRenderer(payload, mainWindow)
    expect(mainWindow.webContents.send).toHaveBeenCalledTimes(1)
    await expect(invokeIpc('get-argv-files')).resolves.toEqual([payload])
  })
})
