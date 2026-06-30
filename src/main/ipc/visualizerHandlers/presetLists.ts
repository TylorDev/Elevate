import type {
  VisualizerCreateListResult,
  VisualizerDataClient,
  VisualizerRenameListPayload,
  VisualizerStateResult,
  VisualizerTogglePresetPayload
} from '../../Types/visualizerHandlers.ts'
import { serializeList, loadVisualizerState } from './state.ts'
import { createStableId, visualizerDb } from './shared.ts'

export async function compactListPositions(
  client: VisualizerDataClient,
  listId: string
): Promise<void> {
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

export async function createVisualizerPresetList(
  name?: string | null
): Promise<VisualizerCreateListResult> {
  const trimmedName = String(name || '').trim() || 'Nueva lista'
  const list = await visualizerDb.visualizerPresetList.create({
    data: {
      id: createStableId('preset-list'),
      name: trimmedName
    },
    include: { items: true }
  })

  return { success: true, list: serializeList(list), state: await loadVisualizerState() }
}

export async function renameVisualizerPresetList(
  payload: VisualizerRenameListPayload = {}
): Promise<VisualizerStateResult> {
  const listId = String(payload.listId || '').trim()
  const name = String(payload.name || '').trim()

  if (!listId || !name) {
    return { success: false, error: 'List id and name are required.' }
  }

  await visualizerDb.visualizerPresetList.update({
    where: { id: listId },
    data: { name }
  })

  return { success: true, state: await loadVisualizerState() }
}

export async function deleteVisualizerPresetList(
  listId?: string | null
): Promise<VisualizerStateResult> {
  const normalizedListId = String(listId || '').trim()
  if (!normalizedListId) {
    return { success: false, error: 'List id is required.' }
  }

  await visualizerDb.$transaction(async (transaction) => {
    const settings = await transaction.visualizerSettings.findUnique({ where: { id: 1 } })

    await transaction.visualizerPresetList.delete({
      where: { id: normalizedListId }
    })

    if (settings?.presetSourceListId === normalizedListId) {
      await transaction.visualizerSettings.upsert({
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
}

export async function togglePresetInVisualizerList(
  payload: VisualizerTogglePresetPayload = {}
): Promise<VisualizerStateResult> {
  const listId = String(payload.listId || '').trim()
  const presetName = String(payload.presetName || '').trim()

  if (!listId || !presetName) {
    return { success: false, error: 'List id and preset name are required.' }
  }

  await visualizerDb.$transaction(async (transaction) => {
    const existing = await transaction.visualizerPresetListItem.findUnique({
      where: {
        listId_presetName: {
          listId,
          presetName
        }
      }
    })

    if (existing) {
      await transaction.visualizerPresetListItem.delete({
        where: { id: existing.id }
      })
      await compactListPositions(transaction, listId)
      await transaction.visualizerPresetList.update({
        where: { id: listId },
        data: { updatedAt: new Date() }
      })
      return
    }

    const lastItem = await transaction.visualizerPresetListItem.findFirst({
      where: { listId },
      orderBy: { position: 'desc' }
    })

    await transaction.visualizerPresetListItem.create({
      data: {
        listId,
        presetName,
        position: lastItem ? lastItem.position + 1 : 0
      }
    })

    await transaction.visualizerPresetList.update({
      where: { id: listId },
      data: { updatedAt: new Date() }
    })
  })

  return { success: true, state: await loadVisualizerState() }
}
