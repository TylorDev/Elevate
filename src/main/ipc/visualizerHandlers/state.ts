import type { VisualizerSettings } from '../../generated/prisma/client.ts'
import type {
  VisualizerDataClient,
  VisualizerListRecord,
  VisualizerPresetListState,
  VisualizerState
} from '../../Types/visualizerHandlers.ts'
import {
  DEFAULT_CYCLE_DURATION,
  getSourceKey,
  SOURCE_MODE_FROM_DB,
  visualizerDb
} from './shared.ts'

export function serializeList(list: VisualizerListRecord): VisualizerPresetListState {
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

export function serializeSettings(
  settings: VisualizerSettings | null | undefined
): Pick<VisualizerState, 'cycleDurationMs' | 'presetSource'> {
  const mode = settings ? SOURCE_MODE_FROM_DB[settings.presetSourceMode] : 'all'
  const listId =
    mode === 'list' && settings?.presetSourceListId ? settings.presetSourceListId : null

  return {
    cycleDurationMs: settings?.cycleDurationMs || DEFAULT_CYCLE_DURATION,
    presetSource: {
      mode: listId ? 'list' : mode === 'favorites' ? 'favorites' : 'all',
      listId
    }
  }
}

export async function ensureSettings(
  client: VisualizerDataClient = visualizerDb
): Promise<VisualizerSettings> {
  return client.visualizerSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  })
}

export async function loadVisualizerState(
  client: VisualizerDataClient = visualizerDb
): Promise<VisualizerState> {
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
    sourceAssociations: associations.reduce<Record<string, string>>((accumulator, association) => {
      const sourceKey = getSourceKey(association.sourceType, association.sourceId)
      if (sourceKey) {
        accumulator[sourceKey] = association.listId
      }
      return accumulator
    }, {})
  }
}
