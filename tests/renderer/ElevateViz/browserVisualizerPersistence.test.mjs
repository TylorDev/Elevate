import { describe, expect, it, vi } from 'vitest'

import {
  FAVORITES_STORAGE_KEY,
  createBrowserVisualizerPersistence
} from '../../../src/renderer/src/ElevateViz/sandbox/src/services/browserVisualizerPersistence.ts'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value))
  }
}

describe('ElevateViz browser persistence', () => {
  it('starts with an empty, usable state without storage', async () => {
    const adapter = createBrowserVisualizerPersistence(null)
    const response = await adapter.persistence.loadVisualizerState()

    expect(adapter.getMode()).toBe('memory')
    expect(response.state).toMatchObject({
      favorites: [],
      presetLists: [],
      sourceAssociations: {}
    })
  })

  it('persists only favorites across adapter instances', async () => {
    const storage = createStorage()
    const first = createBrowserVisualizerPersistence(storage)

    await first.persistence.toggleFavorite('Preset One')
    const created = await first.persistence.createList('Session list')
    await first.persistence.updateVisualizerSettings({ cycleDurationMs: 30_000 })
    await first.persistence.associateSource({
      source: { type: 'playlist', id: 'sandbox.mp3' },
      listId: created.list.id
    })

    const second = createBrowserVisualizerPersistence(storage)
    const reloaded = await second.persistence.loadVisualizerState()

    expect(storage.setItem).toHaveBeenCalledWith(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['Preset One'])
    )
    expect(reloaded.state.favorites).toEqual(['Preset One'])
    expect(reloaded.state.presetLists).toEqual([])
    expect(reloaded.state.sourceAssociations).toEqual({})
    expect(reloaded.state.cycleDurationMs).toBe(6000)
  })

  it('supports temporary list mutations and removes stale associations', async () => {
    const { persistence } = createBrowserVisualizerPersistence(null)
    const created = await persistence.createList('Road')
    const listId = created.list.id

    await persistence.togglePresetInList({ listId, presetName: 'Preset A' })
    await persistence.renameList({ listId, name: 'Night drive' })
    await persistence.associateSource({
      source: { type: 'directory', id: 'C:/Music' },
      listId
    })

    const mutated = await persistence.loadVisualizerState()
    expect(mutated.state.presetLists[0]).toMatchObject({
      name: 'Night drive',
      presetNames: ['Preset A']
    })
    expect(mutated.state.sourceAssociations['directory:C:/Music']).toBe(listId)

    const removed = await persistence.deleteList(listId)
    expect(removed.state.presetLists).toEqual([])
    expect(removed.state.sourceAssociations).toEqual({})
  })

  it('degrades to memory when localStorage throws', async () => {
    const storage = {
      getItem: vi.fn(() => '[]'),
      setItem: vi.fn(() => {
        throw new Error('blocked')
      })
    }
    const adapter = createBrowserVisualizerPersistence(storage)

    await expect(adapter.persistence.toggleFavorite('Preset A')).resolves.toMatchObject({
      state: { favorites: ['Preset A'] }
    })
    expect(adapter.getMode()).toBe('memory')
  })
})
