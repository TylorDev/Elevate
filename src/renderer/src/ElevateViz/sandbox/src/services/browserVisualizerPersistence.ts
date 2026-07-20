import type {
  PresetListSummary,
  VisualizerPersistence,
  VisualizerPersistenceResult,
  VisualizerSource,
  VisualizerState
} from '@elevate-viz'

export const FAVORITES_STORAGE_KEY = 'elevate-viz:sandbox:favorites:v1'

export type BrowserPersistenceMode = 'localStorage' | 'memory'

export interface BrowserVisualizerPersistence {
  persistence: VisualizerPersistence
  getMode: () => BrowserPersistenceMode
  subscribe: (listener: (mode: BrowserPersistenceMode) => void) => () => void
}

const createInitialState = (favorites: string[] = []): VisualizerState => ({
  favorites,
  cycleDurationMs: 6000,
  presetSource: { mode: 'all', listId: null },
  presetLists: [],
  sourceAssociations: {}
})

const cloneState = (state: VisualizerState): VisualizerState => ({
  ...state,
  favorites: [...state.favorites],
  presetSource: { ...state.presetSource },
  presetLists: state.presetLists.map((list) => ({ ...list, presetNames: [...list.presetNames] })),
  sourceAssociations: { ...state.sourceAssociations }
})

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const getSourceKey = (source: VisualizerSource) =>
  source?.type && source?.id ? `${source.type}:${source.id}` : ''

export function createBrowserVisualizerPersistence(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): BrowserVisualizerPersistence {
  let resolvedStorage = storage
  let mode: BrowserPersistenceMode = 'memory'

  if (resolvedStorage === undefined) {
    try {
      resolvedStorage = globalThis.localStorage
    } catch {
      resolvedStorage = null
    }
  }

  let storedFavorites: string[] = []
  if (resolvedStorage) {
    try {
      const parsed = JSON.parse(resolvedStorage.getItem(FAVORITES_STORAGE_KEY) || '[]')
      storedFavorites = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
      mode = 'localStorage'
    } catch {
      resolvedStorage = null
    }
  }

  const state = createInitialState(storedFavorites)
  const listeners = new Set<(mode: BrowserPersistenceMode) => void>()

  const result = (list?: PresetListSummary): VisualizerPersistenceResult => ({
    success: true,
    state: cloneState(state),
    ...(list ? { list: { ...list, presetNames: [...list.presetNames] } } : {})
  })

  const saveFavorites = () => {
    if (!resolvedStorage) return

    try {
      resolvedStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites))
    } catch {
      resolvedStorage = null
      mode = 'memory'
      listeners.forEach((listener) => listener(mode))
    }
  }

  const persistence: VisualizerPersistence = {
    loadVisualizerState: async () => result(),

    updateVisualizerSettings: async (payload) => {
      if (Number.isFinite(payload.cycleDurationMs)) {
        state.cycleDurationMs = Number(payload.cycleDurationMs)
      }
      if (payload.presetSource) {
        state.presetSource = { ...payload.presetSource }
      }
      return result()
    },

    toggleFavorite: async (presetName) => {
      state.favorites = state.favorites.includes(presetName)
        ? state.favorites.filter((name) => name !== presetName)
        : [...state.favorites, presetName]
      saveFavorites()
      return result()
    },

    createList: async (name) => {
      const now = Date.now()
      const list: PresetListSummary = {
        id: `sandbox-list-${createId()}`,
        name: String(name || '').trim() || 'Nueva lista',
        presetNames: [],
        createdAt: now,
        updatedAt: now
      }
      state.presetLists = [...state.presetLists, list]
      return result(list)
    },

    renameList: async ({ listId, name }) => {
      state.presetLists = state.presetLists.map((list) =>
        list.id === listId ? { ...list, name: name.trim(), updatedAt: Date.now() } : list
      )
      return result()
    },

    deleteList: async (listId) => {
      state.presetLists = state.presetLists.filter((list) => list.id !== listId)
      state.sourceAssociations = Object.fromEntries(
        Object.entries(state.sourceAssociations).filter(([, value]) => value !== listId)
      )
      if (state.presetSource.mode === 'list' && state.presetSource.listId === listId) {
        state.presetSource = { mode: 'all', listId: null }
      }
      return result()
    },

    togglePresetInList: async ({ listId, presetName }) => {
      state.presetLists = state.presetLists.map((list) => {
        if (list.id !== listId) return list
        const presetNames = list.presetNames.includes(presetName)
          ? list.presetNames.filter((name) => name !== presetName)
          : [...list.presetNames, presetName]
        return { ...list, presetNames, updatedAt: Date.now() }
      })
      return result()
    },

    associateSource: async ({ source, listId }) => {
      const sourceKey = getSourceKey(source)
      if (sourceKey) state.sourceAssociations[sourceKey] = listId
      return result()
    },

    removeSourceAssociation: async (source) => {
      const sourceKey = getSourceKey(source)
      if (sourceKey) delete state.sourceAssociations[sourceKey]
      return result()
    },

    pruneSourceAssociations: async (sourceKeys) => {
      const validKeys = new Set(['favorites:favorites', ...sourceKeys])
      state.sourceAssociations = Object.fromEntries(
        Object.entries(state.sourceAssociations).filter(([key]) => validKeys.has(key))
      )
      return result()
    }
  }

  return {
    persistence,
    getMode: () => mode,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
