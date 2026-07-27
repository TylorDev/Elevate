/* eslint-disable @typescript-eslint/no-explicit-any */
export const DEFAULT_CYCLE_DURATION = 6000

export const DEFAULT_SOURCE = Object.freeze({
  mode: 'all',
  listId: null
})

export function shuffleArray(array) {
  const shuffled = [...array]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled
}

export function normalizePresetCatalog(rawCatalog) {
  const candidates = [
    rawCatalog?.default?.default,
    rawCatalog?.default,
    rawCatalog,
    globalThis?.elevateButterchurnPresets
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue
    }

    const keys = Object.keys(candidate)
    if (keys.length > 0) {
      return candidate
    }
  }

  return {}
}

export function resolvePresetNavigationOrder(
  activePresetNames = [],
  allPresetNames = [],
  selectedPresetName = ''
) {
  const activeOrder = Array.isArray(activePresetNames) ? activePresetNames : []
  const allOrder = Array.isArray(allPresetNames) ? allPresetNames : []

  if (selectedPresetName && !activeOrder.includes(selectedPresetName)) {
    return allOrder.includes(selectedPresetName) ? allOrder : activeOrder
  }

  return activeOrder.length > 0 ? activeOrder : allOrder
}

export function getAdjacentPresetName(currentName, presetNames = [], direction = 1) {
  if (!Array.isArray(presetNames) || presetNames.length === 0) {
    return ''
  }

  const currentIndex = presetNames.indexOf(currentName)
  const anchorIndex = currentIndex >= 0 ? currentIndex : direction > 0 ? -1 : 0
  return presetNames[getAdjacentPresetIndex(anchorIndex, presetNames.length, direction)] || ''
}

export function createStableId(prefix) {
  if (globalThis?.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizePresetSource(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const mode = rawValue.mode === 'favorites' || rawValue.mode === 'list' ? rawValue.mode : 'all'
    const listId = typeof rawValue.listId === 'string' && rawValue.listId.trim() ? rawValue.listId : null

    if (mode === 'list') {
      return {
        mode,
        listId
      }
    }

    return {
      mode,
      listId: null
    }
  }

  if (rawValue === 'favorites') {
    return {
      mode: 'favorites',
      listId: null
    }
  }

  return {
    mode: 'all',
    listId: null
  }
}

export function normalizePlaybackSource(queueName) {
  if (typeof queueName !== 'string' || !queueName.trim()) {
    return null
  }

  if (queueName.startsWith('folder:')) {
    return {
      type: 'directory',
      id: queueName.slice('folder:'.length)
    }
  }

  if (queueName === 'favourites' || queueName === 'favorites') {
    return {
      type: 'favorites',
      id: 'favorites'
    }
  }

  return {
    type: 'playlist',
    id: queueName
  }
}

export function getSourceKey(source) {
  if (!source?.type || !source?.id) {
    return ''
  }

  return `${source.type}:${source.id}`
}

export function getSourceLabel(source) {
  if (!source?.type || !source?.id) {
    return 'Sin fuente activa'
  }

  if (source.type === 'favorites') {
    return 'Favoritos'
  }

  if (source.type === 'directory') {
    return `Directorio: ${source.id}`
  }

  return `Playlist: ${source.id}`
}

export function findAssociatedPresetList(source, sourceAssociations = {}, presetLists = []) {
  const listId = sourceAssociations[getSourceKey(source)]
  return listId ? presetLists.find((list) => list.id === listId) || null : null
}

export function resolveEffectivePresetSource(presetSource, activePresetList) {
  return activePresetList?.id ? { mode: 'list', listId: activePresetList.id } : presetSource
}

export function getAdjacentPresetIndex(currentIndex, itemCount, direction = 1) {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0
  return (currentIndex + direction + itemCount) % itemCount
}

export function createPresetByNameMap(presetItems = []) {
  return new Map(presetItems.map((preset) => [preset.name, preset]))
}

export function mapPresetNamesToItems(presetNames = [], presetByName = new Map()) {
  return presetNames.map((presetName) => presetByName.get(presetName)).filter(Boolean)
}

export function buildAssociationSources(playlists = [], directories = []) {
  const playlistSources = playlists.map((playlist) => ({
    type: 'playlist',
    id: playlist.path,
    label: playlist.nombre || playlist.path,
    sourceKey: `playlist:${playlist.path}`
  }))

  const directorySources = directories.map((directory) => ({
    type: 'directory',
    id: directory.path,
    label: directory.name || directory.path.split('\\').pop() || directory.path,
    sourceKey: `directory:${directory.path}`
  }))

  return [
    {
      type: 'favorites',
      id: 'favorites',
      label: 'Favoritos',
      sourceKey: 'favorites:favorites'
    },
    ...playlistSources,
    ...directorySources
  ]
}

export function normalizeVisualizerState(rawState: any = {}) {
  return {
    favorites: Array.isArray(rawState.favorites) ? rawState.favorites : [],
    cycleDurationMs: Number.isFinite(rawState.cycleDurationMs)
      ? rawState.cycleDurationMs
      : DEFAULT_CYCLE_DURATION,
    presetSource: normalizePresetSource(rawState.presetSource || DEFAULT_SOURCE),
    presetLists: Array.isArray(rawState.presetLists) ? rawState.presetLists : [],
    sourceAssociations:
      rawState.sourceAssociations &&
      typeof rawState.sourceAssociations === 'object' &&
      !Array.isArray(rawState.sourceAssociations)
        ? rawState.sourceAssociations
        : {}
  }
}
