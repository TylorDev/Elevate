import { describe, expect, it, vi } from 'vitest'

import { createPlaylistFiles } from '../../../src/renderer/src/Contexts/PlaylistContext/playlistFiles.ts'

function createHarness() {
  const invoke = vi.fn()
  const refreshPlaylists = vi.fn(async () => [])
  const notify = vi.fn()
  const translate = vi.fn((key, params = {}) => (params.name ? `${key}:${params.name}` : key))
  const files = createPlaylistFiles({ invoke, refreshPlaylists, notify, translate })
  return { files, invoke, refreshPlaylists, notify, translate }
}

describe('PlaylistContext file operations', () => {
  it('builds a normalized and deduplicated save payload', async () => {
    const harness = createHarness()
    harness.invoke.mockResolvedValue({ success: true, path: 'saved.m3u', playlistName: 'Saved' })

    await harness.files.savePlaylistFromTracks(
      [{ filePath: ' a.mp3 ' }, { filePath: 'a.mp3' }, { filePath: 'b.mp3' }],
      { nombre: 'My list', targetDirectory: 'C:\\Music', replacePath: null }
    )

    expect(harness.invoke).toHaveBeenCalledWith('save-m3u', {
      filePaths: ['a.mp3', 'b.mp3'],
      targetDirectory: 'C:\\Music',
      targetPath: null,
      nombre: 'My list'
    })
    expect(harness.refreshPlaylists).toHaveBeenCalledTimes(1)
  })

  it('does not invoke IPC for empty export input', async () => {
    const harness = createHarness()

    await expect(harness.files.exportPlaylistTracks([{ filePath: '' }])).resolves.toEqual({
      success: false,
      error: 'No tracks to export'
    })
    expect(harness.invoke).not.toHaveBeenCalled()
    expect(harness.notify).toHaveBeenCalledWith('error', 'playlists.exportEmpty')
  })

  it('handles canceled imports without showing an error', async () => {
    const harness = createHarness()
    harness.invoke.mockResolvedValue({ success: false, canceled: true })

    await expect(harness.files.openM3U()).resolves.toEqual({ success: false, canceled: true })
    expect(harness.notify).not.toHaveBeenCalled()
  })

  it('refreshes after successful imports and sends directory export payloads', async () => {
    const harness = createHarness()
    harness.invoke
      .mockResolvedValueOnce({ success: true, path: 'imported.m3u', playlistName: 'Imported' })
      .mockResolvedValueOnce({ success: true, path: 'exported.m3u', playlistName: 'Exported' })

    await harness.files.openM3U({ filePath: 'source.m3u' })
    await harness.files.exportPlaylistTracksToDirectory([{ filePath: 'a.mp3' }], {
      targetDirectory: 'C:\\Exports',
      nombre: 'Exported',
      replacePath: 'old.m3u'
    })

    expect(harness.invoke).toHaveBeenNthCalledWith(1, 'load-list', 'source.m3u')
    expect(harness.invoke).toHaveBeenNthCalledWith(2, 'save-m3u', {
      filePaths: ['a.mp3'],
      targetDirectory: 'C:\\Exports',
      targetPath: 'old.m3u',
      nombre: 'Exported',
      persist: false
    })
    expect(harness.refreshPlaylists).toHaveBeenCalledTimes(1)
  })

  it('resolves and lists playlist save directories', async () => {
    const harness = createHarness()
    harness.invoke
      .mockResolvedValueOnce({ path: 'C:\\Music' })
      .mockResolvedValueOnce({ entries: ['a.m3u'] })

    await expect(harness.files.resolvePlaylistSaveDirectory('source.m3u')).resolves.toBe('C:\\Music')
    await expect(harness.files.listPlaylistSaveDirectory('C:\\Music')).resolves.toEqual({
      entries: ['a.m3u']
    })
  })
})
