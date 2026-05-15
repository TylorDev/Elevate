import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import VisualizerPresetManager from '../../components/Render/VisualizerPresetManager'
import { normalizePlaybackSource, useVisualizerPresets } from '../../components/Render/useVisualizerPresets'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useMini } from '../../Contexts/MiniContext'

function VisualizerPresetsPage() {
  const navigate = useNavigate()
  const { queueState } = useSuper()
  const { playlists, playlistsLoaded, playlistsLoading, getSavedLists } = usePlaylists()
  const { directories, directoriesLoaded, directoriesLoading, getDirectories } = useMini()

  const activePlaybackSource = useMemo(
    () => normalizePlaybackSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const presetControls = useVisualizerPresets({ activePlaybackSource })

  useEffect(() => {
    if (!playlistsLoaded && !playlistsLoading) {
      void getSavedLists()
    }

    if (!directoriesLoaded && !directoriesLoading) {
      void getDirectories()
    }
  }, [
    directoriesLoaded,
    directoriesLoading,
    getDirectories,
    getSavedLists,
    playlistsLoaded,
    playlistsLoading
  ])

  const availableAssociationSources = useMemo(() => {
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
  }, [directories, playlists])

  return (
    <VisualizerPresetManager
      isPage
      onClose={() => navigate('/music')}
      allPresetItems={presetControls.allPresetItems}
      activePresetItems={presetControls.activePresetItems}
      currentPresetName={presetControls.currentPresetName}
      cycleDurationMs={presetControls.cycleDurationMs}
      setCycleDurationMs={presetControls.setCycleDurationMs}
      cycleMode={presetControls.cycleMode}
      setCycleMode={presetControls.setCycleMode}
      toggleFavorite={presetControls.toggleFavorite}
      presetLists={presetControls.presetLists}
      activePresetList={presetControls.activePresetList}
      activePlaybackSource={presetControls.activePlaybackSource}
      sourceAssociations={presetControls.sourceAssociations}
      createPresetList={presetControls.createPresetList}
      renamePresetList={presetControls.renamePresetList}
      deletePresetList={presetControls.deletePresetList}
      togglePresetInList={presetControls.togglePresetInList}
      associateActiveSource={presetControls.associateActiveSource}
      associateSourceToList={presetControls.associateSourceToList}
      removeActiveSourceAssociation={presetControls.removeActiveSourceAssociation}
      removeSourceAssociation={presetControls.removeSourceAssociation}
      availableAssociationSources={availableAssociationSources}
      onSelectPreset={presetControls.setPresetByName}
    />
  )
}

export default VisualizerPresetsPage
