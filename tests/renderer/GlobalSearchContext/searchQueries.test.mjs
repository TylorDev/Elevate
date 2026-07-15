import { describe, expect, it, vi } from 'vitest'

import { createGlobalSearchQueries } from '../../../src/renderer/src/Contexts/GlobalSearchContext/searchQueries.ts'
import { createCategoryState } from '../../../src/renderer/src/Contexts/GlobalSearchContext/searchUtils.ts'

const filters = {
  directory: true,
  playlist: true,
  artist: true,
  name: true,
  configuration: false
}

const page = (items) => ({
  items,
  page: 1,
  pageSize: 50,
  total: items.length,
  hasMore: false
})

function createHarness(invoke) {
  let songs = createCategoryState()
  let playlists = createCategoryState()
  let directories = createCategoryState()

  const setState = (getState, setStateValue) => (value) => {
    const nextValue = typeof value === 'function' ? value(getState()) : value
    setStateValue(nextValue)
  }

  const setSongs = setState(() => songs, (value) => { songs = value })
  const setPlaylists = setState(() => playlists, (value) => { playlists = value })
  const setDirectories = setState(() => directories, (value) => { directories = value })
  const dependencies = {
    debouncedQuery: 'trip hop',
    filters,
    songs,
    playlists,
    directories,
    setSongs,
    setPlaylists,
    setDirectories,
    songsRequestRef: { current: 0 },
    playlistsRequestRef: { current: 0 },
    directoriesRequestRef: { current: 0 },
    invoke
  }

  return {
    dependencies,
    get songs() { return songs },
    get playlists() { return playlists },
    get directories() { return directories }
  }
}

describe('GlobalSearchContext query actions', () => {
  it('uses the configured page sizes and updates category state', async () => {
    const invoke = vi.fn().mockResolvedValue(page([{ filePath: 'song.mp3' }]))
    const harness = createHarness(invoke)
    const actions = createGlobalSearchQueries(harness.dependencies)

    await actions.runSongsSearch()

    expect(invoke).toHaveBeenCalledWith('search-songs-page', {
      query: 'trip hop',
      filters: { name: true, artist: true },
      page: 1,
      pageSize: 50
    })
    expect(harness.songs.items).toEqual([{ filePath: 'song.mp3' }])
    expect(harness.songs.loading).toBe(false)
  })

  it('ignores an older response after a newer request starts', async () => {
    const resolvers = []
    const invoke = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)))
    const harness = createHarness(invoke)
    const actions = createGlobalSearchQueries(harness.dependencies)

    const firstRequest = actions.runSongsSearch()
    const secondRequest = actions.runSongsSearch()

    resolvers[1](page([{ filePath: 'new.mp3' }]))
    await secondRequest
    resolvers[0](page([{ filePath: 'old.mp3' }]))
    await firstRequest

    expect(harness.songs.items).toEqual([{ filePath: 'new.mp3' }])
  })

  it('resets categories for empty queries and invalid responses', async () => {
    const invoke = vi.fn().mockResolvedValue({ invalid: true })
    const harness = createHarness(invoke)
    const actions = createGlobalSearchQueries(harness.dependencies)

    await actions.runSongsSearch()
    expect(harness.songs).toEqual(createCategoryState())

    const emptyHarness = createHarness(invoke)
    const emptyActions = createGlobalSearchQueries({
      ...emptyHarness.dependencies,
      debouncedQuery: ''
    })
    await emptyActions.runSongsSearch()
    expect(emptyHarness.songs).toEqual(createCategoryState())
  })
})
