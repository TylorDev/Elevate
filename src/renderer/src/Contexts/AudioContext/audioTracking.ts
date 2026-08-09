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
import { createPlaybackDiagnosticEvent, createPlaybackDiagnosticId } from './audioDiagnostics'

function getAwardKey(session: PlaybackSession, eventType: PlaybackEventType): string {
  return `${session.cycleId}:${eventType}`
}

export function createAudioTrackingController(
  dependencies: AudioTrackingDependencies
): AudioTrackingController {
  const inFlightAwards = new Set<string>()
  const eligibleAwards = new Set<string>()
  const loggedSuppressions = new Set<string>()

  function appendDiagnostic(
    session: PlaybackSession,
    name: Parameters<typeof createPlaybackDiagnosticEvent>[1],
    options: Parameters<typeof createPlaybackDiagnosticEvent>[2] = {}
  ) {
    const event = createPlaybackDiagnosticEvent(session, name, options)
    dependencies.appendDiagnostic?.(event)
    return event
  }

  function logSuppressionOnce(
    session: PlaybackSession,
    eventType: PlaybackEventType,
    cause: string
  ): void {
    const key = `${getAwardKey(session, eventType)}:${cause}`
    if (loggedSuppressions.has(key)) return
    loggedSuppressions.add(key)
    appendDiagnostic(session, 'award.suppressed', {
      level: cause === 'in-flight' ? 'warn' : 'info',
      details: { eventType, cause }
    })
  }

  async function recordPlaybackEvent(
    session: PlaybackSession | null,
    eventType: PlaybackEventType,
    extra: PlaybackRecordExtras = {}
  ) {
    if (!session?.file?.filePath) {
      return null
    }

    const requestId = createPlaybackDiagnosticId()
    const diagnosticName =
      eventType === 'playback-finalize' ? 'session.finalize.start' : 'award.request'
    const requestEvent = appendDiagnostic(session, diagnosticName, {
      requestId,
      details: { eventType }
    })

    try {
      const result = await dependencies.invokePlaybackRecord({
        eventType,
        filePath: session.file.filePath,
        fileName: session.file.fileName || session.file.title || '',
        duration: toNonNegativeNumber(session.duration),
        ...extra,
        requestId,
        sessionId: session.sessionId,
        cycleId: session.cycleId,
        cycleSequence: session.cycleSequence,
        eventSequence: requestEvent.eventSequence,
        occurredAt: requestEvent.occurredAt,
        diagnosticSnapshot: requestEvent.snapshot
      })

      if (result.success && result.stats) {
        dependencies.updateCurrentFileStats(session.file.filePath, result.stats)
      }

      appendDiagnostic(
        session,
        eventType === 'playback-finalize' ? 'session.finalize.result' : 'award.result',
        {
          requestId,
          level: result.success ? 'info' : 'error',
          details: {
            eventType,
            success: result.success,
            error: result.success ? null : result.error
          }
        }
      )

      return result
    } catch (error) {
      appendDiagnostic(
        session,
        eventType === 'playback-finalize' ? 'session.finalize.result' : 'award.result',
        {
          requestId,
          level: 'error',
          details: {
            eventType,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      )
      console.error(`Error recording playback event "${eventType}":`, error)
      return null
    }
  }

  async function runAward(
    session: PlaybackSession,
    eventType: PlaybackEventType,
    onSuccess: (requestId: string | null) => Promise<void> | void
  ): Promise<boolean> {
    const awardKey = getAwardKey(session, eventType)

    if (inFlightAwards.has(awardKey)) {
      logSuppressionOnce(session, eventType, 'in-flight')
      return false
    }

    inFlightAwards.add(awardKey)

    try {
      const result = await recordPlaybackEvent(session, eventType)

      if (!result?.success) {
        return false
      }

      await onSuccess(result.requestId)
      return true
    } finally {
      inFlightAwards.delete(awardKey)
    }
  }

  async function maybeAwardShortView(session: PlaybackSession | null): Promise<boolean> {
    if (!session) {
      return false
    }

    if (session.shortViewAwarded || session.finalized) {
      logSuppressionOnce(
        session,
        'short-view-award',
        session.finalized ? 'session-finalized' : 'already-awarded-flag'
      )
      return false
    }

    if (getActiveListeningMs(session) < SHORT_VIEW_MS) {
      return false
    }

    const awardKey = getAwardKey(session, 'short-view-award')
    if (!eligibleAwards.has(awardKey)) {
      eligibleAwards.add(awardKey)
      appendDiagnostic(session, 'award.eligible', {
        details: { eventType: 'short-view-award', thresholdSeconds: SHORT_VIEW_MS / 1000 }
      })
    }

    return runAward(session, 'short-view-award', (requestId) => {
      session.shortViewAwarded = true
      dependencies.notifyShortView(session, requestId)
    })
  }

  async function maybeAwardLongView(session: PlaybackSession | null): Promise<boolean> {
    if (!session) {
      return false
    }

    if (session.longViewAwarded || session.finalized) {
      logSuppressionOnce(
        session,
        'long-view-award',
        session.finalized ? 'session-finalized' : 'already-awarded-flag'
      )
      return false
    }

    const durationMs = toNonNegativeNumber(session.duration) * 1000
    const activeListeningMs = getActiveListeningMs(session)
    const reachedCompletionThreshold = hasReachedLongViewCompletion(session)
    const reachedMinimumActiveListening =
      durationMs > 0 && activeListeningMs >= durationMs * LONG_VIEW_MIN_ACTIVE_LISTENING_RATIO

    if (!durationMs || !reachedCompletionThreshold || !reachedMinimumActiveListening) {
      return false
    }

    const awardKey = getAwardKey(session, 'long-view-award')
    if (!eligibleAwards.has(awardKey)) {
      eligibleAwards.add(awardKey)
      appendDiagnostic(session, 'award.eligible', {
        details: {
          eventType: 'long-view-award',
          durationSeconds: durationMs / 1000,
          activeListeningSeconds: activeListeningMs / 1000
        }
      })
    }

    return runAward(session, 'long-view-award', async (requestId) => {
      session.longViewAwarded = true

      if (session.replayCyclePendingCompletionRepeat) {
        const repeatResult = await recordPlaybackEvent(session, 'repeat-award')

        if (repeatResult?.success) {
          session.replayCyclePendingCompletionRepeat = false
        }
      }

      dependencies.notifyLongView(session, requestId)
    })
  }

  async function evaluateSessionAwards(session: PlaybackSession | null): Promise<void> {
    if (!session || session.finalized) {
      return
    }

    await maybeAwardShortView(session)
    await maybeAwardLongView(session)
  }

  async function finalizeCycleSnapshot(session: PlaybackSession | null, countAsRepeat = false) {
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
