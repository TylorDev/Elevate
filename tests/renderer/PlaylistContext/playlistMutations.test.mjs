import { describe, expect, it, vi } from 'vitest'

import { createPlaylistMutations } from '../../../src/renderer/src/Contexts/PlaylistContext/playlistMutations.ts'

function createHarness({ invoke = vi.fn() } = {}) {
  const state = {
    playlists: [{ path: 'list.m3u', nombre: 'List', cover: 'cover', effectiveCover: 'effective' }],
    loaded: true,
    lastLoadedAt: 1,
    deleting: []
  }
  const set = (key) => (value) => {
    state[key] = typeof value === 'function' ? value(state[key]) : value
  }
  const playlistsRef = { current: state.playlists }
  const pendingDeletesRef = { current: new Map() }
  const pendingJobsRef = { current: new Map() }
  const processedJobsRef = { current: new Set() }
  const refreshPlaylists = vi.fn(async () => state.playlists)
  const notify = vi.fn()
  const translate = vi.fn((key) => key)
  const removeTrack = vi.fn(async () => {})
  const addSong = vi.fn(async () => {})

  const mutations = createPlaylistMutations({
    invoke,
    playlistsRef,
    pendingDeletesRef,
    pendingJobsRef,
    processedJobsRef,
    setPlaylists: set('playlists'),
    setPlaylistsLoaded: set('loaded'),
    setPlaylistsLastLoadedAt: set('lastLoadedAt'),
    setDeletingPlaylistPaths: set('deleting'),
    refreshPlaylists,
    notify,
    translate,
    removeTrack,
    addSong
  })

  return { state, invoke, refreshPlaylists, notify, mutations, pendingDeletesRef, pendingJobsRef }
}

describe('PlaylistContext mutations', () => {
  it('preserves existing covers when metadata response omits them', async () => {
    const harness = createHarness()
    harness.invoke.mockResolvedValue({
      success: true,
      playlist: { path: 'list.m3u', nombre: 'Renamed' },
      effectiveCover: null,
      coverConfig: null
    })

    await harness.mutations.updatePlaylistMetadata('list.m3u', { nombre: 'Renamed' })

    expect(harness.state.playlists[0]).toMatchObject({
      path: 'list.m3u',
      nombre: 'Renamed',
      cover: 'cover',
      effectiveCover: 'effective'
    })
  })

  it('queues optimistic deletion and finalizes it once', async () => {
    const harness = createHarness()
    harness.invoke.mockResolvedValue({ success: true, queued: true, jobId: 'job-1', path: 'list.m3u' })

    expect(harness.mutations.deletePlaylist(' list.m3u ')).toEqual({
      success: true,
      queued: true,
      path: 'list.m3u'
    })
    await Promise.resolve()

    expect(harness.state.playlists).toEqual([])
    expect(harness.pendingJobsRef.current.get('job-1')).toBe('list.m3u')
    expect(harness.mutations.isPlaylistDeleting('list.m3u')).toBe(true)

    harness.mutations.handlePlaylistDeleteCompleted({
      jobId: 'job-1',
      path: 'list.m3u',
      success: true,
      error: null
    })
    harness.mutations.handlePlaylistDeleteCompleted({
      jobId: 'job-1',
      path: 'list.m3u',
      success: true,
      error: null
    })

    expect(harness.mutations.isPlaylistDeleting('list.m3u')).toBe(false)
    expect(harness.notify).toHaveBeenCalledTimes(1)
  })

  it('restores an optimistic deletion when IPC fails and rejects duplicates while pending', async () => {
    let rejectRequest
    const invoke = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          rejectRequest = reject
        })
    )
    const harness = createHarness({ invoke })

    harness.mutations.deletePlaylist('list.m3u')
    expect(harness.mutations.deletePlaylist('list.m3u')).toEqual({
      success: true,
      queued: true,
      path: 'list.m3u',
      duplicate: true
    })

    rejectRequest(new Error('offline'))
    await Promise.resolve()
    await Promise.resolve()

    expect(harness.state.playlists).toHaveLength(1)
    expect(harness.mutations.isPlaylistDeleting('list.m3u')).toBe(false)
  })

  it('refreshes playlists after track mutations and sends valid append paths', async () => {
    const harness = createHarness()
    harness.invoke.mockResolvedValue({ success: true, addedCount: 1, skippedCount: 0 })

    await harness.mutations.removeSongFromList('list.m3u', 2)
    await harness.mutations.addSongToList('list.m3u', { filePath: 'a.mp3' })
    await harness.mutations.appendTracksToPlaylist('list.m3u', [
      { filePath: 'a.mp3' },
      { filePath: '' },
      { filePath: 'b.mp3' }
    ])

    expect(harness.refreshPlaylists).toHaveBeenCalledTimes(3)
    expect(harness.invoke).toHaveBeenCalledWith('append-tracks-to-playlist', {
      playlistPath: 'list.m3u',
      filePaths: ['a.mp3', 'b.mp3']
    })
  })
})
