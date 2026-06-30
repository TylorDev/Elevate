import { ipcMain } from 'electron'
import { toggleVisualizerFavorite } from './favorites.ts'
import {
  createVisualizerPresetList,
  deleteVisualizerPresetList,
  renameVisualizerPresetList,
  togglePresetInVisualizerList
} from './presetLists.ts'
import { serializeError } from './shared.ts'
import {
  associateVisualizerSource,
  pruneVisualizerSourceAssociations,
  removeVisualizerSourceAssociation
} from './sourceAssociations.ts'
import { loadVisualizerState } from './state.ts'
import { updateVisualizerSettings } from './settings.ts'
import type {
  VisualizerArgs,
  VisualizerChannel,
  VisualizerInvokeHandler
} from '../../Types/visualizerHandlers.ts'

export type * from '../../Types/visualizerHandlers.ts'

function handleVisualizer<C extends VisualizerChannel>(
  channel: C,
  errorMessage: string,
  handler: VisualizerInvokeHandler<C>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as VisualizerArgs<C>))
    } catch (error) {
      console.error(errorMessage, error)
      return { success: false, error: serializeError(error) }
    }
  })
}

export function setupVisualizerHandlers(): void {
  handleVisualizer('visualizer:load-state', 'Error loading visualizer state:', async () => ({
    success: true,
    state: await loadVisualizerState()
  }))

  handleVisualizer(
    'visualizer:update-settings',
    'Error updating visualizer settings:',
    (_event, payload) => updateVisualizerSettings(payload)
  )

  handleVisualizer(
    'visualizer:toggle-favorite',
    'Error toggling visualizer favorite:',
    (_event, presetName) => toggleVisualizerFavorite(presetName)
  )

  handleVisualizer(
    'visualizer:create-list',
    'Error creating visualizer preset list:',
    (_event, name) => createVisualizerPresetList(name)
  )

  handleVisualizer(
    'visualizer:rename-list',
    'Error renaming visualizer preset list:',
    (_event, payload) => renameVisualizerPresetList(payload)
  )

  handleVisualizer(
    'visualizer:delete-list',
    'Error deleting visualizer preset list:',
    (_event, listId) => deleteVisualizerPresetList(listId)
  )

  handleVisualizer(
    'visualizer:toggle-preset-in-list',
    'Error toggling preset in visualizer list:',
    (_event, payload) => togglePresetInVisualizerList(payload)
  )

  handleVisualizer(
    'visualizer:associate-source',
    'Error associating visualizer source:',
    (_event, payload) => associateVisualizerSource(payload)
  )

  handleVisualizer(
    'visualizer:remove-source-association',
    'Error removing visualizer source association:',
    (_event, source) => removeVisualizerSourceAssociation(source)
  )

  handleVisualizer(
    'visualizer:prune-source-associations',
    'Error pruning visualizer source associations:',
    (_event, sourceKeys) => pruneVisualizerSourceAssociations(sourceKeys)
  )
}
