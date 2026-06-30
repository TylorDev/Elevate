import type {
  VisualizerSettingsMutationData,
  VisualizerStateResult,
  VisualizerUpdateSettingsPayload
} from '../../Types/visualizerHandlers.ts'
import { loadVisualizerState } from './state.ts'
import { normalizePresetSource, SOURCE_MODE_TO_DB, visualizerDb } from './shared.ts'

export async function updateVisualizerSettings(
  payload: VisualizerUpdateSettingsPayload = {}
): Promise<VisualizerStateResult> {
  const data: VisualizerSettingsMutationData = {}

  if (Number.isFinite(payload.cycleDurationMs)) {
    data.cycleDurationMs = Math.max(1000, Math.round(payload.cycleDurationMs as number))
  }

  if (payload.presetSource) {
    const presetSource = normalizePresetSource(payload.presetSource)
    let mode = SOURCE_MODE_TO_DB[presetSource.mode]
    let listId: string | null = null

    if (presetSource.mode === 'list' && presetSource.listId) {
      const list = await visualizerDb.visualizerPresetList.findUnique({
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

  await visualizerDb.visualizerSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data }
  })

  return { success: true, state: await loadVisualizerState() }
}
