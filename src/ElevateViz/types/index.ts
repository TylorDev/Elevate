import type { ReactNode } from 'react'

export type ElevateVizView = 'stage' | 'presets'
export type ElevateVizDisplayMode = 'cover' | 'visualizer'

export interface VisualizerPresetSource {
  mode: 'all' | 'favorites' | 'list'
  listId: string | null
}

export interface VisualizerSource {
  type: 'favorites' | 'playlist' | 'directory'
  id: string
  label?: string
  sourceKey?: string
}

export interface PresetListSummary {
  id: string
  name: string
  presetNames: string[]
  createdAt?: number
  updatedAt?: number
}

export interface VisualizerState {
  favorites: string[]
  cycleDurationMs: number
  presetSource: VisualizerPresetSource
  presetLists: PresetListSummary[]
  sourceAssociations: Record<string, string>
}

export interface VisualizerPersistenceResult {
  success: true
  state: VisualizerState
  list?: PresetListSummary
}

export interface VisualizerPersistence {
  loadVisualizerState: () => Promise<VisualizerPersistenceResult>
  updateVisualizerSettings: (
    payload: Partial<Pick<VisualizerState, 'cycleDurationMs' | 'presetSource'>>
  ) => Promise<VisualizerPersistenceResult>
  toggleFavorite: (presetName: string) => Promise<VisualizerPersistenceResult>
  createList: (name: string) => Promise<VisualizerPersistenceResult>
  renameList: (payload: { listId: string; name: string }) => Promise<VisualizerPersistenceResult>
  deleteList: (listId: string) => Promise<VisualizerPersistenceResult>
  togglePresetInList: (payload: {
    listId: string
    presetName: string
  }) => Promise<VisualizerPersistenceResult>
  associateSource: (payload: {
    source: VisualizerSource
    listId: string
  }) => Promise<VisualizerPersistenceResult>
  removeSourceAssociation: (source: VisualizerSource) => Promise<VisualizerPersistenceResult>
  pruneSourceAssociations: (sourceKeys: string[]) => Promise<VisualizerPersistenceResult>
}

export interface ElevateVizAudioGraph {
  audioElement: HTMLMediaElement | null
  audioContext: AudioContext | null
  sourceNode: MediaElementAudioSourceNode | null
  analyser: AnalyserNode | null
}

export interface ElevateVizPlayback {
  isPlaying: boolean
  hasCurrentTrack: boolean
  currentTrackId: string | null
  progressSeconds: number
  durationSeconds: number
  onTogglePlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (event: React.MouseEvent<HTMLElement>) => void
}

export interface ElevateVizPreferences {
  rightClickHintDisabled: boolean
  isStepEnabled: boolean
  onToggleStep: () => void
}

export interface ElevateVizHostProps {
  children: ReactNode
  audio: ElevateVizAudioGraph
  playback: ElevateVizPlayback
  coverUrl?: string | null
  activeSource?: VisualizerSource | null
  availableSources?: VisualizerSource[]
  preferences: ElevateVizPreferences
  persistence?: VisualizerPersistence
}

export interface ElevateVizProps {
  view: ElevateVizView
  isPictureInPictureMode?: boolean
  onExitPictureInPicture?: () => void
  onNavigateStage?: () => void
  onNavigatePresets?: () => void
  onOpenTrackHistory?: () => void
  defaultDisplayMode?: ElevateVizDisplayMode
}

export interface ElevateVizAssociationsApi {
  isReady: boolean
  presetLists: PresetListSummary[]
  sourceAssociations: Record<string, string>
  associateSource: (source: VisualizerSource, listId: string) => Promise<unknown>
  removeSourceAssociation: (source: VisualizerSource) => Promise<unknown>
  getSourceKey: (source: VisualizerSource | null | undefined) => string
}
