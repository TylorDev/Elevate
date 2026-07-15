import { describe, expect, it, vi } from 'vitest'

import { registerPlaylistNotifications } from '../../../src/renderer/src/Contexts/PlaylistContext/playlistNotifications.ts'

function createEventTarget() {
  const listeners = new Map()
  return {
    on: vi.fn((channel, listener) => {
      listeners.set(channel, listener)
    }),
    off: vi.fn((channel, listener) => {
      if (listeners.get(channel) === listener) listeners.delete(channel)
    }),
    emit: (channel, payload) => listeners.get(channel)?.(payload)
  }
}

describe('PlaylistContext notifications', () => {
  it('registers listeners, refreshes on directory changes and ignores scan progress', () => {
    const ipc = createEventTarget()
    const getAllSongs = vi.fn(async () => {})
    const getDirectories = vi.fn(async () => {})
    const handlePlaylistDeleteCompleted = vi.fn()
    const notify = vi.fn()
    const translate = vi.fn((key) => key)
    const cleanup = registerPlaylistNotifications({
      ipc,
      getAllSongs,
      getDirectories,
      handlePlaylistDeleteCompleted,
      notify,
      translate
    })

    ipc.emit('notification', '[directory-changed]')
    ipc.emit('notification', '{"type":"scan-progress","percent":20}')
    ipc.emit('notification', 'finished')

    expect(getAllSongs).toHaveBeenCalledWith(1, { reset: true })
    expect(getDirectories).toHaveBeenCalledWith({ force: true })
    expect(notify).toHaveBeenCalledWith('success', 'finished')

    cleanup()
    expect(ipc.off).toHaveBeenCalledTimes(2)
    ipc.emit('notification', 'after cleanup')
    expect(notify).not.toHaveBeenCalledWith('success', 'after cleanup')
  })

  it('routes toast notifications and delete completion events', () => {
    const ipc = createEventTarget()
    const handlePlaylistDeleteCompleted = vi.fn()
    const notify = vi.fn()
    registerPlaylistNotifications({
      ipc,
      getAllSongs: vi.fn(async () => {}),
      getDirectories: vi.fn(),
      handlePlaylistDeleteCompleted,
      notify,
      translate: (key) => key
    })

    ipc.emit('notification', { type: 'toast', variant: 'error', message: 'Failed' })
    const completed = { jobId: 'job-1', path: 'list.m3u', success: true, error: null }
    ipc.emit('playlist-delete-completed', completed)

    expect(notify).toHaveBeenCalledWith('error', 'Failed')
    expect(handlePlaylistDeleteCompleted).toHaveBeenCalledWith(completed)
  })
})
