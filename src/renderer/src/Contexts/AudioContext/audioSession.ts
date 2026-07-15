import type {
  AudioElementSnapshot,
  PendingReplay,
  PlaybackSession,
  PlaybackSessionEndReason
} from '../../Types/AudioContextTypes'
import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'

import {
  LONG_VIEW_COMPLETION_THRESHOLD,
  REPLAY_RESTART_THRESHOLD,
  SKIP_WINDOW_MS,
  toNonNegativeNumber
} from './audioUtils'

export function createPlaybackSession(
  file: AudioFileInfo | null | undefined,
  now = Date.now()
): PlaybackSession | null {
  if (!file?.filePath) {
    return null
  }

  return {
    id: `${file.filePath}|${now}`,
    file,
    duration: toNonNegativeNumber(file.duration),
    activeListeningMs: 0,
    activeSegmentStartedAt: null,
    lastKnownCurrentTime: 0,
    shortViewAwarded: false,
    longViewAwarded: false,
    replayCyclePendingCompletionRepeat: false,
    skipAwarded: false,
    finalizing: false,
    finalized: false
  }
}

export function getActiveListeningMs(session: PlaybackSession | null, now = Date.now()): number {
  if (!session) {
    return 0
  }

  if (session.activeSegmentStartedAt == null) {
    return session.activeListeningMs
  }

  return session.activeListeningMs + Math.max(0, now - session.activeSegmentStartedAt)
}

export function startActiveSegment(session: PlaybackSession | null, now = Date.now()): void {
  if (!session || session.finalized || session.activeSegmentStartedAt != null) {
    return
  }

  session.activeSegmentStartedAt = now
}

export function stopActiveSegment(session: PlaybackSession | null, now = Date.now()): void {
  if (!session || session.activeSegmentStartedAt == null) {
    return
  }

  session.activeListeningMs += Math.max(0, now - session.activeSegmentStartedAt)
  session.activeSegmentStartedAt = null
}

export function resetPlaybackCycle(
  session: PlaybackSession | null,
  audio: AudioElementSnapshot | null = null,
  now = Date.now()
): void {
  if (!session) {
    return
  }

  const currentTime = toNonNegativeNumber(audio?.currentTime)

  session.activeListeningMs = 0
  session.activeSegmentStartedAt = audio && !audio.paused ? now : null
  session.lastKnownCurrentTime = currentTime
  session.shortViewAwarded = false
  session.longViewAwarded = false
  session.skipAwarded = false
  session.finalizing = false
}

export function getRestartThresholdTime(durationSeconds: unknown): number {
  return toNonNegativeNumber(durationSeconds) * REPLAY_RESTART_THRESHOLD
}

export function isReplayStartPosition(currentTime: unknown, durationSeconds: unknown): boolean {
  const thresholdTime = getRestartThresholdTime(durationSeconds)

  return thresholdTime > 0 && toNonNegativeNumber(currentTime) <= thresholdTime
}

export function syncPlaybackSession(
  session: PlaybackSession | null,
  audio: AudioElementSnapshot | null,
  { allowSegmentStart = false }: { allowSegmentStart?: boolean } = {},
  now = Date.now()
): PlaybackSession | null {
  if (!session || session.finalized || !audio) {
    return null
  }

  session.duration = Math.max(
    0,
    Number(audio.duration) || Number(session.file.duration) || Number(session.duration) || 0
  )
  session.lastKnownCurrentTime = toNonNegativeNumber(audio.currentTime)

  if (allowSegmentStart && !audio.paused) {
    startActiveSegment(session, now)
  }

  return session
}

export function hasReachedLongViewCompletion(session: PlaybackSession): boolean {
  const durationSeconds = toNonNegativeNumber(session.duration)
  const currentTime = toNonNegativeNumber(session.lastKnownCurrentTime)

  return (
    durationSeconds > 0 &&
    currentTime / durationSeconds >= LONG_VIEW_COMPLETION_THRESHOLD
  )
}

export function shouldAwardSkip(
  session: PlaybackSession,
  reason: PlaybackSessionEndReason
): boolean {
  return (
    !session.skipAwarded &&
    !session.longViewAwarded &&
    reason !== 'ended' &&
    getActiveListeningMs(session) < SKIP_WINDOW_MS
  )
}

export function createPendingReplay(
  session: PlaybackSession,
  reason: PlaybackSessionEndReason
): PendingReplay | null {
  if (reason !== 'ended' || !session.longViewAwarded) {
    return null
  }

  return {
    filePath: session.file.filePath
  }
}
