import type {
  VisualizerAssociateSourcePayload,
  VisualizerSource,
  VisualizerStateResult
} from '../../Types/visualizerHandlers.ts'
import { loadVisualizerState } from './state.ts'
import { getSourceKey, normalizeSource, SOURCE_TYPE_TO_DB, visualizerDb } from './shared.ts'

export async function associateVisualizerSource(
  payload: VisualizerAssociateSourcePayload = {}
): Promise<VisualizerStateResult> {
  const source = normalizeSource(payload.source)
  const listId = String(payload.listId || '').trim()

  if (!source || !listId) {
    return { success: false, error: 'Source and list id are required.' }
  }

  await visualizerDb.visualizerSourceAssociation.upsert({
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
}

export async function removeVisualizerSourceAssociation(
  sourcePayload?: Partial<VisualizerSource> | null
): Promise<VisualizerStateResult> {
  const source = normalizeSource(sourcePayload)
  if (!source) {
    return { success: false, error: 'Source is required.' }
  }

  await visualizerDb.visualizerSourceAssociation.deleteMany({
    where: {
      sourceType: SOURCE_TYPE_TO_DB[source.type],
      sourceId: source.id
    }
  })

  return { success: true, state: await loadVisualizerState() }
}

export async function pruneVisualizerSourceAssociations(
  sourceKeys: string[] = []
): Promise<VisualizerStateResult> {
  const existingSourceKeys = new Set(Array.isArray(sourceKeys) ? sourceKeys : [])
  const associations = await visualizerDb.visualizerSourceAssociation.findMany()
  const staleAssociationIds = associations
    .filter((association) => {
      const sourceKey = getSourceKey(association.sourceType, association.sourceId)
      return sourceKey !== 'favorites:favorites' && !existingSourceKeys.has(sourceKey)
    })
    .map((association) => association.id)

  if (staleAssociationIds.length > 0) {
    await visualizerDb.visualizerSourceAssociation.deleteMany({
      where: { id: { in: staleAssociationIds } }
    })
  }

  return { success: true, state: await loadVisualizerState() }
}
