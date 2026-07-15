import type { ReactNode } from 'react'

import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  PlaybackEventType,
  PlaybackRecordPayload,
  PlaybackRecordResult,
  PlaybackStats
} from '../../../../main/Types/likeHandlers.ts'

export type AudioProviderProps = {
  children: ReactNode
}

export type AudioElementSnapshot = Pick<HTMLAudioElement, 'currentTime' | 'duration' | 'paused'>

export type PlaybackSession = {
  id: string
  file: AudioFileInfo
  duration: number
  activeListeningMs: number
  activeSegmentStartedAt: number | null
  lastKnownCurrentTime: number
  shortViewAwarded: boolean
  longViewAwarded: boolean
  replayCyclePendingCompletionRepeat: boolean
  skipAwarded: boolean
  finalizing: boolean
  finalized: boolean
}

export type PendingReplay = {
  filePath: string
}

export type PlaybackSessionEndReason = 'change' | 'ended' | 'track-change' | 'audio-provider-unmount'

export type AudioPlaybackRecordPayload = PlaybackRecordPayload & {
  shortViewAwarded?: boolean
  longViewAwarded?: boolean
}

export type PlaybackRecordExtras = Omit<
  Partial<AudioPlaybackRecordPayload>,
  'eventType' | 'filePath' | 'fileName' | 'duration'
>

export type PlaybackRecordInvoker = (
  payload: AudioPlaybackRecordPayload
) => Promise<PlaybackRecordResult>

export type PlaybackStatsUpdater = (filePath: string, stats: Partial<PlaybackStats>) => void

export type AudioTrackingDependencies = {
  invokePlaybackRecord: PlaybackRecordInvoker
  updateCurrentFileStats: PlaybackStatsUpdater
  notifyShortView: () => void
  notifyLongView: () => void
}

export type AudioTrackingController = {
  recordPlaybackEvent: (
    session: PlaybackSession | null,
    eventType: PlaybackEventType,
    extra?: PlaybackRecordExtras
  ) => Promise<PlaybackRecordResult | null>
  maybeAwardShortView: (session: PlaybackSession | null) => Promise<boolean>
  maybeAwardLongView: (session: PlaybackSession | null) => Promise<boolean>
  evaluateSessionAwards: (session: PlaybackSession | null) => Promise<void>
  finalizeCycleSnapshot: (
    session: PlaybackSession | null,
    countAsRepeat?: boolean
  ) => Promise<PlaybackRecordResult | null>
}
