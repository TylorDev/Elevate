import { describe, expect, it, vi } from 'vitest'

import { createPlaylistQueries } from '../../../src/renderer/src/Contexts/PlaylistContext/playlistQueries.ts'

function createHarness() {
  const state = {
    playlists: [],
    playlistsLoading: false,
    playlistsLoaded: false,
    playlistsLastLoadedAt: null,
    allSongs: [],
    allSongsLoading: false,
    allSongsHasMore: true,
    allSongsPage: 0,
    randomPlaylist: null,
    news: []
  }

  const set = (key) => (value) => {
    state[key] = typeof value === 'function' ? value(state[key]) : value
  }

  const invoke = vi.fn()
  const latestInvoke = vi.fn(async (channel, ...args) => ({
    isLatest: true,
    result: await invoke(channel, ...args)
  }))
  const get = vi.fn(async (channel, setState, value) => {
    const result = await invoke(channel, value)
    setState?.(result)
    return result
  })

  const playlistsRef = { current: state.playlists }
  const playlistsLoadedRef = { current: false }
  const playlistsRequestRef = { current: null }
  const allSongsRequestRef = { current: null }
  const allSongsLoadedPagesRef = { current: new Set() }

  const queries = createPlaylistQueries({
    invoke,
    get,
    getNewsMessage: 'Recents loaded',
    latestInvoke,
    playlistsRef,
    playlistsLoadedRef,
    playlistsRequestRef,
    setPlaylists: set('playlists'),
    setPlaylistsLoading: set('playlistsLoading'),
    setPlaylistsLoaded: set('playlistsLoaded'),
    setPlaylistsLastLoadedAt: set('playlistsLastLoadedAt'),
    allSongsRequestRef,
    allSongsLoadedPagesRef,
    setAllSongs: set('allSongs'),
    setAllSongsLoading: set('allSongsLoading'),
    setAllSongsHasMore: set('allSongsHasMore'),
    setAllSongsPage: set('allSongsPage'),
    setRandomPlaylist: set('randomPlaylist'),
    setNews: set('news')
  })

  return { state, invoke, latestInvoke, get, queries, allSongsLoadedPagesRef }
}

describe('PlaylistContext queries', () => {
  it('uses the loaded playlist cache and deduplicates concurrent requests', async () => {
    const harness = createHarness()
    const playlists = [{ path: 'C:\\Music\\favorites.m3u', nombre: 'Favorites' }]
    harness.invoke.mockResolvedValue(playlists)

    await expect(harness.queries.getSavedLists()).resolves.toEqual(playlists)
    await expect(harness.queries.getSavedLists()).resolves.toEqual(playlists)

    expect(harness.latestInvoke).toHaveBeenCalledTimes(1)
  })

  it('merges pages without duplicate file paths and resets pagination state', async () => {
    const harness = createHarness()
    harness.invoke
      .mockResolvedValueOnce({
        items: [
          { filePath: 'a.mp3' },
          { filePath: 'b.mp3' }
        ],
        page: 1,
        pageSize: 2,
        total: 3,
        hasMore: true
      })
      .mockResolvedValueOnce({
        items: [
          { filePath: 'b.mp3' },
          { filePath: 'c.mp3' }
        ],
        page: 2,
        pageSize: 2,
        total: 3,
        hasMore: false
      })
      .mockResolvedValueOnce({
        items: [
          { filePath: 'b.mp3' },
          { filePath: 'c.mp3' }
        ],
        page: 1,
        pageSize: 2,
        total: 2,
        hasMore: false
      })

    await harness.queries.getAllSongs(1, { pageSize: 2 })
    await harness.queries.getAllSongs(2, { pageSize: 2 })

    expect(harness.state.allSongs.map((song) => song.filePath)).toEqual(['a.mp3', 'b.mp3', 'c.mp3'])
    expect(harness.state.allSongsHasMore).toBe(false)
    expect(harness.state.allSongsPage).toBe(2)

    await harness.queries.getAllSongs(1, { pageSize: 2, reset: true })
    expect(harness.allSongsLoadedPagesRef.current.has(1)).toBe(true)
    expect(harness.state.allSongs).toEqual([{ filePath: 'b.mp3' }, { filePath: 'c.mp3' }])
  })

  it('clears loading flags after a failed request', async () => {
    const harness = createHarness()
    harness.invoke.mockRejectedValue(new Error('offline'))

    await expect(harness.queries.getAllSongs()).rejects.toThrow('offline')
    expect(harness.state.allSongsLoading).toBe(false)
    expect(harness.allSongsLoadedPagesRef.current.size).toBe(0)
  })

  it('loads random playlists, unique lists and news through injected getters', async () => {
    const harness = createHarness()
    harness.invoke
      .mockResolvedValueOnce({ path: 'random.m3u' })
      .mockResolvedValueOnce({ processedData: [], playlistData: null })
      .mockResolvedValueOnce([{ filePath: 'new.mp3' }])

    await expect(harness.queries.getRandomList()).resolves.toEqual({ path: 'random.m3u' })
    await expect(harness.queries.getUniqueList(() => {}, 'list.m3u')).resolves.toEqual({
      processedData: [],
      playlistData: null
    })
    await expect(harness.queries.getNews()).resolves.toEqual([{ filePath: 'new.mp3' }])
    expect(harness.get).toHaveBeenCalledTimes(3)
  })
})
