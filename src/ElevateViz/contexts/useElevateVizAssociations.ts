import {
  useVisualizerListActions,
  useVisualizerSources
} from './VisualizerContext'
import { getSourceKey } from '../utils/visualizerUtils'
import type { ElevateVizAssociationsApi } from '../types'

export function useElevateVizAssociations(): ElevateVizAssociationsApi {
  const { presetLists, sourceAssociations, visualizerLoaded } = useVisualizerSources()
  const { associateSourceToList, removeSourceAssociation } = useVisualizerListActions()

  return {
    isReady: visualizerLoaded,
    presetLists,
    sourceAssociations,
    associateSource: associateSourceToList,
    removeSourceAssociation,
    getSourceKey
  }
}
