import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildAssociationSources,
  createPresetByNameMap,
  findAssociatedPresetList,
  getAdjacentPresetIndex,
  getSourceKey,
  mapPresetNamesToItems,
  normalizePlaybackSource,
  normalizePresetSource,
  normalizeVisualizerState,
  resolveEffectivePresetSource,
  shuffleArray
} from '../../../src/ElevateViz/utils/visualizerUtils.ts'

afterEach(() => vi.restoreAllMocks())

describe('ElevateViz domain helpers', () => {
  it('normalizes Player queue names into neutral visualizer sources', () => {
    expect(normalizePlaybackSource('folder:C:\\Music')).toEqual({
      type: 'directory',
      id: 'C:\\Music'
    })
    expect(normalizePlaybackSource('favorites')).toEqual({ type: 'favorites', id: 'favorites' })
    expect(normalizePlaybackSource('mix.m3u')).toEqual({ type: 'playlist', id: 'mix.m3u' })
    expect(normalizePlaybackSource('')).toBeNull()
  })

  it('normalizes persisted preset state and invalid sources safely', () => {
    expect(normalizePresetSource({ mode: 'list', listId: 'road' })).toEqual({
      mode: 'list',
      listId: 'road'
    })
    expect(normalizePresetSource({ mode: 'list', listId: '' })).toEqual({
      mode: 'list',
      listId: null
    })
    expect(normalizeVisualizerState({ favorites: 'invalid' })).toMatchObject({
      favorites: [],
      presetLists: [],
      sourceAssociations: {}
    })
  })

  it('resolves associations and lets the active source override the global preset source', () => {
    const source = { type: 'playlist', id: 'mix.m3u' }
    const lists = [{ id: 'road', name: 'Road', presetNames: ['one'] }]
    const associations = { [getSourceKey(source)]: 'road', 'playlist:stale': 'missing' }
    const activeList = findAssociatedPresetList(source, associations, lists)

    expect(activeList).toBe(lists[0])
    expect(findAssociatedPresetList({ type: 'playlist', id: 'stale' }, associations, lists)).toBeNull()
    expect(resolveEffectivePresetSource({ mode: 'favorites', listId: null }, activeList)).toEqual({
      mode: 'list',
      listId: 'road'
    })
  })

  it('builds the association catalog without Player-specific objects', () => {
    expect(
      buildAssociationSources(
        [{ path: 'mix.m3u', nombre: 'Mix' }],
        [{ path: 'C:\\Music', name: 'Music' }]
      )
    ).toEqual([
      { type: 'favorites', id: 'favorites', label: 'Favoritos', sourceKey: 'favorites:favorites' },
      { type: 'playlist', id: 'mix.m3u', label: 'Mix', sourceKey: 'playlist:mix.m3u' },
      {
        type: 'directory',
        id: 'C:\\Music',
        label: 'Music',
        sourceKey: 'directory:C:\\Music'
      }
    ])
  })

  it('maps catalogs, shuffles immutably, and wraps preset navigation', () => {
    const presets = [{ name: 'one' }, { name: 'two' }]
    const byName = createPresetByNameMap(presets)
    expect(mapPresetNamesToItems(['two', 'missing'], byName)).toEqual([presets[1]])

    vi.spyOn(Math, 'random').mockReturnValue(0)
    const shuffled = shuffleArray(['one', 'two', 'three'])
    expect(shuffled).toEqual(['two', 'three', 'one'])
    expect(getAdjacentPresetIndex(2, 3, 1)).toBe(0)
    expect(getAdjacentPresetIndex(0, 3, -1)).toBe(2)
    expect(getAdjacentPresetIndex(0, 0, 1)).toBe(0)
  })
})
