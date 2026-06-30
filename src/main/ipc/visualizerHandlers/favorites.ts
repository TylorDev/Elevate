import type { VisualizerStateResult } from '../../Types/visualizerHandlers.ts'
import { loadVisualizerState } from './state.ts'
import { visualizerDb } from './shared.ts'

export async function toggleVisualizerFavorite(
  presetName?: string | null
): Promise<VisualizerStateResult> {
  const normalizedPresetName = String(presetName || '').trim()
  if (!normalizedPresetName) {
    return { success: false, error: 'Preset name is required.' }
  }

  const existing = await visualizerDb.visualizerPresetFavorite.findUnique({
    where: { presetName: normalizedPresetName }
  })

  if (existing) {
    await visualizerDb.visualizerPresetFavorite.delete({
      where: { presetName: normalizedPresetName }
    })
  } else {
    await visualizerDb.visualizerPresetFavorite.create({
      data: { presetName: normalizedPresetName }
    })
  }

  return { success: true, state: await loadVisualizerState() }
}
