import { describe, expect, it, vi } from 'vitest'

import {
  createPendingReplay,
  createPlaybackSession,
  getActiveListeningMs,
  isReplayStartPosition,
  resetPlaybackCycle,
  shouldAwardSkip,
  startActiveSegment,
  stopActiveSegment
} from '../../src/renderer/src/Contexts/AudioContext/audioSession.ts'
import { createAudioTrackingController } from '../../src/renderer/src/Contexts/AudioContext/audioTracking.ts'
import { sanitizePath } from '../../src/renderer/src/Contexts/AudioContext/audioUtils.ts'

function createFile(overrides = {}) {
  return {
    filePath: 'C:\\Music\\song.mp3',
    fileName: 'song.mp3',
    title: 'Song',
    duration: 100,
    ...overrides
  }
}

function createSession(overrides = {}) {
  return {
    ...createPlaybackSession(createFile(), 0),
    ...overrides
  }
}

function createTracking(overrides = {}) {
  const dependencies = {
    invokePlaybackRecord: vi.fn(async () => ({ success: true, stats: {} })),
    updateCurrentFileStats: vi.fn(),
    notifyShortView: vi.fn(),
    notifyLongView: vi.fn(),
    ...overrides
  }

  return {
    dependencies,
    controller: createAudioTrackingController(dependencies)
  }
}

describe('AudioContext session helpers', () => {
  it('normalizes Windows paths and encoded hash characters', () => {
    expect(sanitizePath('C:\\Music\\song#1.mp3')).toBe('file:///C:/Music/song%231.mp3')
    expect(sanitizePath('relative/song.mp3')).toBe('relative/song.mp3')
    expect(sanitizePath(null)).toBeNull()
  })

  it('accumulates active listening time without double-starting a segment', () => {
    const session = createSession()

    startActiveSegment(session, 100)
    startActiveSegment(session, 200)
    stopActiveSegment(session, 10_100)

    expect(session.activeListeningMs).toBe(10_000)
    expect(getActiveListeningMs(session, 12_000)).toBe(10_000)

    startActiveSegment(session, 12_000)
    expect(getActiveListeningMs(session, 15_000)).toBe(13_000)
  })

  it('resets cycle metrics while preserving the session identity', () => {
    const session = createSession({
      activeListeningMs: 30_000,
      lastKnownCurrentTime: 80,
      shortViewAwarded: true,
      longViewAwarded: true,
      skipAwarded: true,
      finalizing: true
    })

    resetPlaybackCycle(session, { currentTime: 2, duration: 100, paused: false }, 500)

    expect(session.id).toBe('C:\\Music\\song.mp3|0')
    expect(session.activeListeningMs).toBe(0)
    expect(session.activeSegmentStartedAt).toBe(500)
    expect(session.lastKnownCurrentTime).toBe(2)
    expect(session.shortViewAwarded).toBe(false)
    expect(session.longViewAwarded).toBe(false)
    expect(session.skipAwarded).toBe(false)
    expect(session.finalizing).toBe(false)
  })

  it('detects replay starts only inside the configured restart threshold', () => {
    expect(isReplayStartPosition(15, 100)).toBe(true)
    expect(isReplayStartPosition(16, 100)).toBe(true)
    expect(isReplayStartPosition(17, 100)).toBe(false)
  })

  it('only awards skips for short non-ended sessions', () => {
    const session = createSession({ activeListeningMs: 29_999 })

    expect(shouldAwardSkip(session, 'track-change')).toBe(true)
    expect(shouldAwardSkip(session, 'audio-provider-unmount')).toBe(true)
    expect(shouldAwardSkip(session, 'ended')).toBe(false)

    session.activeListeningMs = 30_000
    expect(shouldAwardSkip(session, 'track-change')).toBe(false)
  })

  it('creates a pending replay only after a qualified ended cycle', () => {
    const session = createSession({ longViewAwarded: true })

    expect(createPendingReplay(session, 'ended')).toEqual({ filePath: session.file.filePath })
    expect(createPendingReplay(session, 'track-change')).toBeNull()
  })
})

describe('AudioContext tracking', () => {
  it('awards short views once after ten seconds of active listening', async () => {
    const { controller, dependencies } = createTracking()
    const session = createSession({ activeListeningMs: 10_000 })

    await expect(controller.maybeAwardShortView(session)).resolves.toBe(true)
    await expect(controller.maybeAwardShortView(session)).resolves.toBe(false)

    expect(dependencies.invokePlaybackRecord).toHaveBeenCalledTimes(1)
    expect(session.shortViewAwarded).toBe(true)
    expect(dependencies.notifyShortView).toHaveBeenCalledTimes(1)
  })

  it('requires both completion progress and active listening for long views', async () => {
    const { controller, dependencies } = createTracking()
    const session = createSession({
      duration: 100,
      lastKnownCurrentTime: 70,
      activeListeningMs: 40_000
    })

    await expect(controller.maybeAwardLongView(session)).resolves.toBe(true)

    expect(session.longViewAwarded).toBe(true)
    expect(dependencies.notifyLongView).toHaveBeenCalledTimes(1)
    expect(dependencies.invokePlaybackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'long-view-award' })
    )
  })

  it('does not send duplicate awards while an IPC request is pending', async () => {
    let releaseRequest
    const invokePlaybackRecord = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseRequest = resolve
        })
    )
    const { controller, dependencies } = createTracking({ invokePlaybackRecord })
    const session = createSession({ activeListeningMs: 10_000 })

    const firstAward = controller.maybeAwardShortView(session)
    const secondAward = controller.maybeAwardShortView(session)

    expect(dependencies.invokePlaybackRecord).toHaveBeenCalledTimes(1)
    await expect(secondAward).resolves.toBe(false)

    releaseRequest({ success: true, stats: {} })
    await expect(firstAward).resolves.toBe(true)
  })

  it('keeps session flags unchanged when IPC recording fails', async () => {
    const { controller } = createTracking({
      invokePlaybackRecord: vi.fn(async () => ({ success: false, error: 'offline' }))
    })
    const session = createSession({ activeListeningMs: 10_000 })

    await expect(controller.maybeAwardShortView(session)).resolves.toBe(false)
    expect(session.shortViewAwarded).toBe(false)
  })

  it('builds finalization payloads with active listening and cycle state', async () => {
    const { controller, dependencies } = createTracking()
    const session = createSession({
      activeListeningMs: 10_500,
      shortViewAwarded: true,
      longViewAwarded: false
    })

    await controller.finalizeCycleSnapshot(session, true)

    expect(dependencies.invokePlaybackRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'playback-finalize',
        activeListeningSeconds: 10.5,
        shortViewAwarded: true,
        longViewAwarded: false,
        countAsRepeat: true
      })
    )
  })
})
