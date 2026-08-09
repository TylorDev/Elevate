import type {
  PlaybackDiagnosticAppendPayload,
  PlaybackDiagnosticName
} from '../../../../main/Types/playbackDiagnostics.ts'
import type { PlaybackSession } from '../../Types/AudioContextTypes'

export function createPlaybackDiagnosticId(): string {
  const randomUuid = globalThis.crypto?.randomUUID

  if (typeof randomUuid === 'function') {
    return randomUuid.call(globalThis.crypto)
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`
}

export function createPlaybackDiagnosticEvent(
  session: PlaybackSession,
  name: PlaybackDiagnosticName,
  options: {
    requestId?: string | null
    level?: 'debug' | 'info' | 'warn' | 'error'
    audio?: HTMLAudioElement | null
    details?: Record<string, string | number | boolean | null>
  } = {}
): PlaybackDiagnosticAppendPayload {
  session.eventSequence += 1

  return {
    schemaVersion: 1 as const,
    name,
    occurredAt: new Date().toISOString(),
    level: options.level,
    sessionId: session.sessionId,
    cycleId: session.cycleId,
    requestId: options.requestId ?? null,
    cycleSequence: session.cycleSequence,
    eventSequence: session.eventSequence,
    filePath: session.file.filePath,
    snapshot: {
      visibilityState: typeof document === 'undefined' ? null : document.visibilityState,
      documentHasFocus: typeof document === 'undefined' ? null : document.hasFocus(),
      audio: options.audio
        ? {
            currentTime: finiteOrNull(options.audio.currentTime),
            duration: finiteOrNull(options.audio.duration),
            paused: options.audio.paused,
            ended: options.audio.ended,
            readyState: options.audio.readyState,
            playbackRate: finiteOrNull(options.audio.playbackRate)
          }
        : null,
      activeListeningSeconds:
        (session.activeListeningMs +
          (session.activeSegmentStartedAt == null
            ? 0
            : Math.max(0, Date.now() - session.activeSegmentStartedAt))) /
        1000,
      flags: {
        shortViewAwarded: session.shortViewAwarded,
        longViewAwarded: session.longViewAwarded,
        replayCyclePendingCompletionRepeat: session.replayCyclePendingCompletionRepeat,
        skipAwarded: session.skipAwarded,
        finalizing: session.finalizing,
        finalized: session.finalized
      }
    },
    details: options.details
  } as PlaybackDiagnosticAppendPayload
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
