// @ts-nocheck
import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { prisma } from '../prisma.ts'

const DEFAULT_CYCLE_DURATION = 6000

const SOURCE_MODE_TO_DB = {
  all: 'ALL',
  favorites: 'FAVORITES',
  list: 'LIST'
}

const SOURCE_MODE_FROM_DB = {
  ALL: 'all',
  FAVORITES: 'favorites',
  LIST: 'list'
}

const SOURCE_TYPE_TO_DB = {
  favorites: 'FAVORITES',
  playlist: 'PLAYLIST',
  directory: 'DIRECTORY'
}

const SOURCE_TYPE_FROM_DB = {
  FAVORITES: 'favorites',
  PLAYLIST: 'playlist',
  DIRECTORY: 'directory'
}

function createStableId(prefix) {
  return `${prefix}-${randomUUID()}`
}

function serializeError(error) {
  return error instanceof Error ? error.message : String(error)
}

function normalizePresetSource(rawValue = {}) {
  const mode = rawValue.mode === 'favorites' || rawValue.mode === 'list' ? rawValue.mode : 'all'
  const listId = typeof rawValue.listId === 'string' && rawValue.listId.trim() ? rawValue.listId : null

  if (mode === 'list' && listId) {
    return { mode, listId }
  }

  return { mode: mode === 'favorites' ? 'favorites' : 'all', listId: null }
}

function normalizeSource(rawValue = {}) {
  const type = SOURCE_TYPE_TO_DB[rawValue.type] ? rawValue.type : null
  const id = typeof rawValue.id === 'string' && rawValue.id.trim() ? rawValue.id : null

  if (!type || !id) {
    return null
  }

  return { type, id }
}

function getSourceKey(sourceType, sourceId) {
  const type = SOURCE_TYPE_FROM_DB[sourceType]
  return type && sourceId ? `${type}:${sourceId}` : ''
}

function serializeList(list) {
  return {
    id: list.id,
    name: list.name,
    presetNames: (list.items || [])
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((item) => item.presetName),
    createdAt: list.createdAt?.getTime?.() ?? Date.now(),
    updatedAt: list.updatedAt?.getTime?.() ?? Date.now()
  }
}

function serializeSettings(settings) {
  const mode = SOURCE_MODE_FROM_DB[settings?.presetSourceMode] || 'all'
  const listId = mode === 'list' && settings?.presetSourceListId ? settings.presetSourceListId : null

  return {
    cycleDurationMs: settings?.cycleDurationMs || DEFAULT_CYCLE_DURATION,
    presetSource: {
      mode: listId ? 'list' : mode === 'favorites' ? 'favorites' : 'all',
      listId
    }
  }
}

async function ensureSettings(client = prisma) {
  return client.visualizerSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  })
}

async function loadVisualizerState(client = prisma) {
  const [settings, favorites, presetLists, associations] = await Promise.all([
    ensureSettings(client),
    client.visualizerPresetFavorite.findMany({
      orderBy: { createdAt: 'asc' }
    }),
    client.visualizerPresetList.findMany({
      include: {
        items: {
          orderBy: { position: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    }),
    client.visualizerSourceAssociation.findMany({
      orderBy: { createdAt: 'asc' }
    })
  ])

  return {
    ...serializeSettings(settings),
    favorites: favorites.map((favorite) => favorite.presetName),
    presetLists: presetLists.map(serializeList),
    sourceAssociations: associations.reduce((accumulator, association) => {
      const sourceKey = getSourceKey(association.sourceType, association.sourceId)
      if (sourceKey) {
        accumulator[sourceKey] = association.listId
      }
      return accumulator
    }, {})
  }
}

async function compactListPositions(client, listId) {
  const items = await client.visualizerPresetListItem.findMany({
    where: { listId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }]
  })

  await Promise.all(
    items.map((item, index) =>
      client.visualizerPresetListItem.update({
        where: { id: item.id },
        data: { position: index }
      })
    )
  )
}

export function setupVisualizerHandlers() {
  ipcMain.handle('visualizer:load-state', async () => {
    try {
      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error loading visualizer state:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:update-settings', async (_, payload = {}) => {
    try {
      const data = {}

      if (Number.isFinite(payload.cycleDurationMs)) {
        data.cycleDurationMs = Math.max(1000, Math.round(payload.cycleDurationMs))
      }

      if (payload.presetSource) {
        const presetSource = normalizePresetSource(payload.presetSource)
        let mode = SOURCE_MODE_TO_DB[presetSource.mode] || 'ALL'
        let listId = null

        if (presetSource.mode === 'list' && presetSource.listId) {
          const list = await prisma.visualizerPresetList.findUnique({
            where: { id: presetSource.listId },
            select: { id: true }
          })

          if (list) {
            mode = 'LIST'
            listId = list.id
          } else {
            mode = 'ALL'
          }
        }

        data.presetSourceMode = mode
        data.presetSourceListId = listId
      }

      await prisma.visualizerSettings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data }
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error updating visualizer settings:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:toggle-favorite', async (_, presetName) => {
    try {
      const normalizedPresetName = String(presetName || '').trim()
      if (!normalizedPresetName) {
        return { success: false, error: 'Preset name is required.' }
      }

      const existing = await prisma.visualizerPresetFavorite.findUnique({
        where: { presetName: normalizedPresetName }
      })

      if (existing) {
        await prisma.visualizerPresetFavorite.delete({
          where: { presetName: normalizedPresetName }
        })
      } else {
        await prisma.visualizerPresetFavorite.create({
          data: { presetName: normalizedPresetName }
        })
      }

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error toggling visualizer favorite:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:create-list', async (_, name) => {
    try {
      const trimmedName = String(name || '').trim() || 'Nueva lista'
      const list = await prisma.visualizerPresetList.create({
        data: {
          id: createStableId('preset-list'),
          name: trimmedName
        },
        include: { items: true }
      })

      return { success: true, list: serializeList(list), state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error creating visualizer preset list:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:rename-list', async (_, payload = {}) => {
    try {
      const listId = String(payload.listId || '').trim()
      const name = String(payload.name || '').trim()

      if (!listId || !name) {
        return { success: false, error: 'List id and name are required.' }
      }

      await prisma.visualizerPresetList.update({
        where: { id: listId },
        data: { name }
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error renaming visualizer preset list:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:delete-list', async (_, listId) => {
    try {
      const normalizedListId = String(listId || '').trim()
      if (!normalizedListId) {
        return { success: false, error: 'List id is required.' }
      }

      await prisma.$transaction(async (tx) => {
        const settings = await tx.visualizerSettings.findUnique({ where: { id: 1 } })

        await tx.visualizerPresetList.delete({
          where: { id: normalizedListId }
        })

        if (settings?.presetSourceListId === normalizedListId) {
          await tx.visualizerSettings.upsert({
            where: { id: 1 },
            update: {
              presetSourceMode: 'ALL',
              presetSourceListId: null
            },
            create: { id: 1 }
          })
        }
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error deleting visualizer preset list:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:toggle-preset-in-list', async (_, payload = {}) => {
    try {
      const listId = String(payload.listId || '').trim()
      const presetName = String(payload.presetName || '').trim()

      if (!listId || !presetName) {
        return { success: false, error: 'List id and preset name are required.' }
      }

      await prisma.$transaction(async (tx) => {
        const existing = await tx.visualizerPresetListItem.findUnique({
          where: {
            listId_presetName: {
              listId,
              presetName
            }
          }
        })

        if (existing) {
          await tx.visualizerPresetListItem.delete({
            where: { id: existing.id }
          })
          await compactListPositions(tx, listId)
          await tx.visualizerPresetList.update({
            where: { id: listId },
            data: { updatedAt: new Date() }
          })
          return
        }

        const lastItem = await tx.visualizerPresetListItem.findFirst({
          where: { listId },
          orderBy: { position: 'desc' }
        })

        await tx.visualizerPresetListItem.create({
          data: {
            listId,
            presetName,
            position: lastItem ? lastItem.position + 1 : 0
          }
        })

        await tx.visualizerPresetList.update({
          where: { id: listId },
          data: { updatedAt: new Date() }
        })
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error toggling preset in visualizer list:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:associate-source', async (_, payload = {}) => {
    try {
      const source = normalizeSource(payload.source)
      const listId = String(payload.listId || '').trim()

      if (!source || !listId) {
        return { success: false, error: 'Source and list id are required.' }
      }

      await prisma.visualizerSourceAssociation.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: SOURCE_TYPE_TO_DB[source.type],
            sourceId: source.id
          }
        },
        update: { listId },
        create: {
          sourceType: SOURCE_TYPE_TO_DB[source.type],
          sourceId: source.id,
          listId
        }
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error associating visualizer source:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:remove-source-association', async (_, sourcePayload = {}) => {
    try {
      const source = normalizeSource(sourcePayload)
      if (!source) {
        return { success: false, error: 'Source is required.' }
      }

      await prisma.visualizerSourceAssociation.deleteMany({
        where: {
          sourceType: SOURCE_TYPE_TO_DB[source.type],
          sourceId: source.id
        }
      })

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error removing visualizer source association:', error)
      return { success: false, error: serializeError(error) }
    }
  })

  ipcMain.handle('visualizer:prune-source-associations', async (_, sourceKeys = []) => {
    try {
      const existingSourceKeys = new Set(Array.isArray(sourceKeys) ? sourceKeys : [])
      const associations = await prisma.visualizerSourceAssociation.findMany()
      const staleAssociationIds = associations
        .filter((association) => {
          const sourceKey = getSourceKey(association.sourceType, association.sourceId)
          return sourceKey !== 'favorites:favorites' && !existingSourceKeys.has(sourceKey)
        })
        .map((association) => association.id)

      if (staleAssociationIds.length > 0) {
        await prisma.visualizerSourceAssociation.deleteMany({
          where: { id: { in: staleAssociationIds } }
        })
      }

      return { success: true, state: await loadVisualizerState() }
    } catch (error) {
      console.error('Error pruning visualizer source associations:', error)
      return { success: false, error: serializeError(error) }
    }
  })
}
