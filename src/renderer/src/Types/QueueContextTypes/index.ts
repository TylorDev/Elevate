import type { Dispatch, ReactNode, SetStateAction } from 'react'

import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'

export type QueueProviderProps = {
  children: ReactNode
}

export type QueueState = {
  currentQueue: AudioFileInfo[]
  originalQueue: AudioFileInfo[]
  queueName: string
}

export type ManualQueueOrders = Record<string, string[]>

export type QueueNavigationOptions = {
  shouldNavigate?: boolean
}

export type QueueTranslator = (
  key: string,
  params?: Record<string, unknown>,
  fallback?: string
) => string

export type QueueIpcInvoker = (channel: string, ...args: unknown[]) => Promise<unknown>

export type QueueNotificationActions = {
  notifyRemoved: (delayMs?: number) => void
  notifySongAdded: (songName: string) => void
}

export type QueueContextValue = {
  queueState: QueueState
  setQueueState: Dispatch<SetStateAction<QueueState>>
  currentFile: AudioFileInfo | null
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
  currentIndex: number
  setCurrentIndex: Dispatch<SetStateAction<number>>
  isShuffled: boolean
  setIsShuffled: Dispatch<SetStateAction<boolean>>
  manualQueueOrders: ManualQueueOrders
  setManualQueueOrders: Dispatch<SetStateAction<ManualQueueOrders>>
  PlayQueue: (list: AudioFileInfo[], name: string, index?: number | null) => void
  playQueueShuffled: (list: AudioFileInfo[], name: string) => void
  appendToCurrentQueue: (song: AudioFileInfo) => void
  appendManyToCurrentQueue: (songs?: AudioFileInfo[]) => void
  appendToQueueAndPlay: (song: AudioFileInfo) => void
  removeFromCurrentQueue: (index: number) => void
  reorderCurrentQueue: (nextBaseQueue: AudioFileInfo[]) => void
  handleNextClick: () => void
  handlePreviousClick: () => void
  toggleShuffle: () => void
  handleSongClick: (
    file: AudioFileInfo,
    index: number,
    list: AudioFileInfo[],
    name: string
  ) => void
  handleQueueAndPlay: (
    song?: AudioFileInfo,
    index?: number,
    filePath?: string,
    shouldNavigate?: boolean
  ) => Promise<void>
  openDirectoryQueue: (
    directoryPath: string,
    options?: QueueNavigationOptions
  ) => Promise<AudioFileInfo[]>
  removeTrack: (playlistPath: string, index: number) => Promise<void>
  addSong: (playlistPath: string, newTrack: AudioFileInfo) => Promise<void>
}

export type QueueStateDependencies = {
  currentFile: AudioFileInfo | null
  currentIndex: number
  isShuffled: boolean
  setQueueState: Dispatch<SetStateAction<QueueState>>
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
  setCurrentIndex: Dispatch<SetStateAction<number>>
  setIsShuffled: Dispatch<SetStateAction<boolean>>
  notifyRemoved: QueueNotificationActions['notifyRemoved']
}

export type QueueStateActions = Pick<
  QueueContextValue,
  | 'PlayQueue'
  | 'playQueueShuffled'
  | 'appendToCurrentQueue'
  | 'appendManyToCurrentQueue'
  | 'appendToQueueAndPlay'
  | 'removeFromCurrentQueue'
  | 'reorderCurrentQueue'
  | 'handleSongClick'
> & {
  applyBaseQueue: (list: AudioFileInfo[], name: string, index?: number | null) => void
}

export type QueueControlDependencies = {
  queueState: QueueState
  currentFile: AudioFileInfo | null
  currentIndex: number
  isShuffled: boolean
  setQueueState: Dispatch<SetStateAction<QueueState>>
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
  setCurrentIndex: Dispatch<SetStateAction<number>>
  setIsShuffled: Dispatch<SetStateAction<boolean>>
  navigateToMusic: () => void
}

export type QueueControlActions = Pick<
  QueueContextValue,
  'handleNextClick' | 'handlePreviousClick' | 'toggleShuffle'
>

export type QueuePlaybackDependencies = {
  applyBaseQueue: QueueStateActions['applyBaseQueue']
  invoke: QueueIpcInvoker
  navigate: (path: string) => void
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
  setCurrentIndex: Dispatch<SetStateAction<number>>
}

export type QueuePlaybackActions = Pick<
  QueueContextValue,
  'handleQueueAndPlay' | 'openDirectoryQueue'
>

export type QueueMutationDependencies = {
  currentFile: AudioFileInfo | null
  currentIndex: number
  isShuffled: boolean
  invoke: QueueIpcInvoker
  setQueueState: Dispatch<SetStateAction<QueueState>>
  setCurrentFile: Dispatch<SetStateAction<AudioFileInfo | null>>
  setCurrentIndex: Dispatch<SetStateAction<number>>
  notify: QueueNotificationActions
}

export type QueueMutationActions = Pick<QueueContextValue, 'removeTrack' | 'addSong'>
