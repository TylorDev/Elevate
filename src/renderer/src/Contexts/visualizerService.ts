async function invokeVisualizer(channel, payload) {
  const response = await window.electron?.ipcRenderer?.invoke(channel, payload)

  if (!response?.success) {
    throw new Error(response?.error || `Visualizer IPC failed: ${channel}`)
  }

  return response
}

export const visualizerService = {
  loadVisualizerState: () => invokeVisualizer('visualizer:load-state'),
  updateVisualizerSettings: (payload) => invokeVisualizer('visualizer:update-settings', payload),
  toggleFavorite: (presetName) => invokeVisualizer('visualizer:toggle-favorite', presetName),
  createList: (name) => invokeVisualizer('visualizer:create-list', name),
  renameList: (payload) => invokeVisualizer('visualizer:rename-list', payload),
  deleteList: (listId) => invokeVisualizer('visualizer:delete-list', listId),
  togglePresetInList: (payload) => invokeVisualizer('visualizer:toggle-preset-in-list', payload),
  associateSource: (payload) => invokeVisualizer('visualizer:associate-source', payload),
  removeSourceAssociation: (source) => invokeVisualizer('visualizer:remove-source-association', source),
  pruneSourceAssociations: (sourceKeys) =>
    invokeVisualizer('visualizer:prune-source-associations', sourceKeys)
}
