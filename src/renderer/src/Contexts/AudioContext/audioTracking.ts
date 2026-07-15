import type {
  AudioTrackingController,
  AudioTrackingDependencies,
  PlaybackRecordExtras,
  PlaybackSession
} from '../../Types/AudioContextTypes'
import type { PlaybackEventType } from '../../../../main/Types/likeHandlers.ts'

import { getActiveListeningMs, hasReachedLongViewCompletion } from './audioSession'
import {
  LONG_VIEW_MIN_ACTIVE_LISTENING_RATIO,
  SHORT_VIEW_MS,
  toNonNegativeNumber
} from './audioUtils'

function getAwardKey(session: PlaybackSession, eventType: PlaybackEventType): string {
  return `${session.id}:${eventType}`
}

export function createAudioTrackingController(
  dependencies: AudioTrackingDependencies
): AudioTrackingController {
  const inFlightAwards = new Set<string>()

  async function recordPlaybackEvent(
    session: PlaybackSession | null,
    eventType: PlaybackEventType,
    extra: PlaybackRecordExtras = {}
  ) {
    if (!session?.file?.filePath) {
      return null
    }

    try {
      const result = await dependencies.invokePlaybackRecord({
        eventType,
        filePath: session.file.filePath,
        fileName: session.file.fileName || session.file.title || '',
        duration: toNonNegativeNumber(session.duration),
        ...extra
      })

      if (result.success && result.stats) {
        dependencies.updateCurrentFileStats(session.file.filePath, result.stats)
      }

      return result
    } catch (error) {
      console.error(`Error recording playback event "${eventType}":`, error)
      return null
    }
  }

  async function runAward(
    session: PlaybackSession,
    eventType: PlaybackEventType,
    onSuccess: () => Promise<void> | void
  ): Promise<boolean> {
    const awardKey = getAwardKey(session, eventType)

    if (inFlightAwards.has(awardKey)) {
      return false
    }

    inFlightAwards.add(awardKey)

    try {
      const result = await recordPlaybackEvent(session, eventType)

      if (!result?.success) {
        return false
      }

      await onSuccess()
      return true
    } finally {
      inFlightAwards.delete(awardKey)
    }
  }

  async function maybeAwardShortView(session: PlaybackSession | null): Promise<boolean> {
    if (!session || session.shortViewAwarded || session.finalized) {
      return false
    }

    if (getActiveListeningMs(session) < SHORT_VIEW_MS) {
      return false
    }

    return runAward(session, 'short-view-award', () => {
      session.shortViewAwarded = true
      dependencies.notifyShortView()
    })
  }

  async function maybeAwardLongView(session: PlaybackSession | null): Promise<boolean> {
    if (!session || session.longViewAwarded || session.finalized) {
      return false
    }

    const durationMs = toNonNegativeNumber(session.duration) * 1000
    const activeListeningMs = getActiveListeningMs(session)
    const reachedCompletionThreshold = hasReachedLongViewCompletion(session)
    const reachedMinimumActiveListening =
      durationMs > 0 &&
      activeListeningMs >= durationMs * LONG_VIEW_MIN_ACTIVE_LISTENING_RATIO

    if (!durationMs || !reachedCompletionThreshold || !reachedMinimumActiveListening) {
      return false
    }

    return runAward(session, 'long-view-award', async () => {
      session.longViewAwarded = true

      if (session.replayCyclePendingCompletionRepeat) {
        const repeatResult = await recordPlaybackEvent(session, 'repeat-award')

        if (repeatResult?.success) {
          session.replayCyclePendingCompletionRepeat = false
        }
      }

      dependencies.notifyLongView()
    })
  }

  async function evaluateSessionAwards(session: PlaybackSession | null): Promise<void> {
    if (!session || session.finalized) {
      return
    }

    await maybeAwardShortView(session)
    await maybeAwardLongView(session)
  }

  async function finalizeCycleSnapshot(
    session: PlaybackSession | null,
    countAsRepeat = false
  ) {
    if (!session) {
      return null
    }

    return recordPlaybackEvent(session, 'playback-finalize', {
      activeListeningSeconds: getActiveListeningMs(session) / 1000,
      shortViewAwarded: session.shortViewAwarded,
      longViewAwarded: session.longViewAwarded,
      countAsRepeat
    })
  }

  return {
    recordPlaybackEvent,
    maybeAwardShortView,
    maybeAwardLongView,
    evaluateSessionAwards,
    finalizeCycleSnapshot
  }
}
