import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'react-toastify'

import type {
  AudioProviderProps,
  AudioTrackingController,
  PlaybackRecordInvoker,
  PlaybackSession,
  PendingReplay,
  PlaybackSessionEndReason,
  PlaybackStatsUpdater
} from '../../Types/AudioContextTypes'
import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type { PlaybackRecordResult } from '../../../../main/Types/likeHandlers.ts'

import { useArgv } from '../ArgvContext'
import { usePlayback } from '../PlaybackContext'
import { useQueue } from '../QueueContext'
import {
  createPendingReplay,
  createPlaybackSession,
  isReplayStartPosition,
  shouldAwardSkip,
  startActiveSegment,
  stopActiveSegment,
  resetPlaybackCycle,
  syncPlaybackSession
} from './audioSession'
import { createAudioTrackingController } from './audioTracking'
import {
  REPLAY_WRAP_BACKTRACK_MS,
  TOAST_OPTIONS,
  sanitizePath,
  toNonNegativeNumber
} from './audioUtils'

export function AudioProvider({ children }: AudioProviderProps) {
  const { currentFile, setCurrentFile } = useQueue()
  const { mediaRef, mediaElement, volume, muted, loop, attachMediaElement } = usePlayback()
  const { autoplayRequestId } = useArgv() as { autoplayRequestId?: number }
  const playbackSessionRef = useRef<PlaybackSession | null>(null)
  const pendingReplayRef = useRef<PendingReplay | null>(null)
  const currentFileRef = useRef(currentFile)

  currentFileRef.current = currentFile

  const path = sanitizePath(currentFile?.filePath)

  const updateCurrentFileStats = useCallback<PlaybackStatsUpdater>(
    (filePath, stats) => {
      setCurrentFile((activeFile) => {
        if (!activeFile || activeFile.filePath !== filePath) {
          return activeFile
        }

        return {
          ...activeFile,
          ...stats
        }
      })
    },
    [setCurrentFile]
  )

  const invokePlaybackRecord = useCallback<PlaybackRecordInvoker>(async (payload) => {
    const result = await window.electron.ipcRenderer.invoke('playback:record', payload)
    return result as PlaybackRecordResult
  }, [])

  const notifyShortView = useCallback(() => {
    toast.success('+1 short views', TOAST_OPTIONS)
  }, [])

  const notifyLongView = useCallback(() => {
    toast.success('+1 long views', TOAST_OPTIONS)
  }, [])

  const tracking = useMemo<AudioTrackingController>(
    () =>
      createAudioTrackingController({
        invokePlaybackRecord,
        updateCurrentFileStats,
        notifyShortView,
        notifyLongView
      }),
    [invokePlaybackRecord, notifyLongView, notifyShortView, updateCurrentFileStats]
  )

  const openPlaybackSession = useCallback((file: AudioFileInfo | null | undefined) => {
    const session = createPlaybackSession(file)
    playbackSessionRef.current = session
    return session
  }, [])

  const ensureSession = useCallback(() => {
    return (
      playbackSessionRef.current ||
      openPlaybackSession(currentFileRef.current as AudioFileInfo | null | undefined)
    )
  }, [openPlaybackSession])

  const syncSessionFromAudio = useCallback(
    (
      audio: HTMLAudioElement | null,
      options: { allowSegmentStart?: boolean } = {}
    ): PlaybackSession | null => {
      return syncPlaybackSession(ensureSession(), audio, options)
    },
    [ensureSession]
  )

  const confirmQualifiedCycleAndRestart = useCallback(
    async (audio: HTMLAudioElement | null = mediaRef.current): Promise<boolean> => {
      const session = playbackSessionRef.current

      if (!session || session.finalized || session.finalizing || !session.longViewAwarded) {
        return false
      }

      session.finalizing = true
      syncSessionFromAudio(audio)
      stopActiveSegment(session)

      const result = await tracking.finalizeCycleSnapshot(session, true)

      if (!result?.success) {
        session.finalizing = false
        if (audio && !audio.paused) {
          startActiveSegment(session)
        }
        return false
      }

      pendingReplayRef.current = null
      resetPlaybackCycle(session, audio)
      session.replayCyclePendingCompletionRepeat = true
      return true
    },
    [mediaRef, syncSessionFromAudio, tracking]
  )

  const confirmPendingReplayStart = useCallback(
    async (audio: HTMLAudioElement | null = mediaRef.current): Promise<boolean> => {
      const pendingReplay = pendingReplayRef.current
      const activeFilePath = currentFileRef.current?.filePath

      if (!pendingReplay || !activeFilePath || pendingReplay.filePath !== activeFilePath) {
        return false
      }

      const currentTime = toNonNegativeNumber(audio?.currentTime)
      const durationSeconds = Math.max(
        0,
        Number(audio?.duration) || Number(currentFileRef.current?.duration) || 0
      )

      if (!isReplayStartPosition(currentTime, durationSeconds)) {
        return false
      }

      const session = ensureSession()

      if (!session || session.finalized || session.finalizing) {
        return false
      }

      session.finalizing = true

      const result = await tracking.recordPlaybackEvent(session, 'playback-finalize', {
        activeListeningSeconds: 0,
        shortViewAwarded: false,
        longViewAwarded: false,
        countAsRepeat: true
      })

      if (!result?.success) {
        session.finalizing = false
        return false
      }

      pendingReplayRef.current = null
      resetPlaybackCycle(session, audio)
      session.replayCyclePendingCompletionRepeat = true
      return true
    },
    [ensureSession, mediaRef, tracking]
  )

  const finalizePlaybackSession = useCallback(
    async (
      reason: PlaybackSessionEndReason = 'change',
      audio: HTMLAudioElement | null = mediaRef.current
    ): Promise<void> => {
      const session = playbackSessionRef.current

      if (!session || session.finalized || session.finalizing) {
        return
      }

      session.finalizing = true

      syncSessionFromAudio(audio)
      stopActiveSegment(session)
      await tracking.evaluateSessionAwards(session)

      if (shouldAwardSkip(session, reason)) {
        const skipResult = await tracking.recordPlaybackEvent(session, 'skip-award')
        if (skipResult?.success) {
          session.skipAwarded = true
        }
      }

      const result = await tracking.finalizeCycleSnapshot(session, false)
      session.finalizing = false

      if (!result?.success) {
        return
      }

      pendingReplayRef.current = createPendingReplay(session, reason)
      session.finalized = true

      if (playbackSessionRef.current === session) {
        playbackSessionRef.current = null
      }
    },
    [mediaRef, syncSessionFromAudio, tracking]
  )

  useEffect(() => {
    const activeFilePath = currentFile?.filePath

    if (pendingReplayRef.current && pendingReplayRef.current.filePath !== activeFilePath) {
      pendingReplayRef.current = null
    }

    if (activeFilePath) {
      openPlaybackSession(currentFile as AudioFileInfo)
    }

    return () => {
      void finalizePlaybackSession('track-change')
    }
  }, [currentFile?.filePath, finalizePlaybackSession, openPlaybackSession])

  useEffect(() => {
    if (!mediaElement) {
      return
    }

    const audio = mediaElement as HTMLAudioElement
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0))
    audio.muted = Boolean(muted)
    audio.loop = Boolean(loop)
  }, [loop, mediaElement, muted, volume])

  useEffect(() => {
    if (!mediaElement) {
      return
    }

    const audio = mediaElement as HTMLAudioElement

    const handlePlay = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })
      void (async () => {
        await confirmPendingReplayStart(audio)
        await tracking.evaluateSessionAwards(playbackSessionRef.current || session)
      })()
    }

    const handlePause = () => {
      const session = syncSessionFromAudio(audio)
      stopActiveSegment(session)
      void tracking.evaluateSessionAwards(session)
    }

    const handleTimeUpdate = () => {
      const previousSession = playbackSessionRef.current
      const previousTime = toNonNegativeNumber(previousSession?.lastKnownCurrentTime)
      const currentTime = toNonNegativeNumber(audio.currentTime)
      const durationSeconds = Math.max(
        0,
        Number(audio.duration) || Number(previousSession?.duration) || 0
      )
      const didWrapToReplayStart =
        Boolean(previousSession?.longViewAwarded) &&
        previousTime - currentTime >= REPLAY_WRAP_BACKTRACK_MS / 1000 &&
        isReplayStartPosition(currentTime, durationSeconds)

      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })

      if (didWrapToReplayStart) {
        void confirmQualifiedCycleAndRestart(audio)
        return
      }

      void tracking.evaluateSessionAwards(session)
    }

    const handleLoadedMetadata = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
      void tracking.evaluateSessionAwards(session)
    }

    const handleSeeked = () => {
      const sessionBeforeSeek = playbackSessionRef.current
      const previousTime = toNonNegativeNumber(sessionBeforeSeek?.lastKnownCurrentTime)
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
      const currentTime = toNonNegativeNumber(audio.currentTime)
      const durationSeconds = Math.max(
        0,
        Number(audio.duration) || Number(session?.duration) || 0
      )
      const didReplaySeek =
        Boolean(sessionBeforeSeek?.longViewAwarded) &&
        previousTime > currentTime &&
        isReplayStartPosition(currentTime, durationSeconds)

      if (didReplaySeek) {
        void confirmQualifiedCycleAndRestart(audio)
        return
      }

      void tracking.evaluateSessionAwards(session)
    }

    const handleEnded = () => {
      const session = syncSessionFromAudio(audio)
      stopActiveSegment(session)
      void tracking.evaluateSessionAwards(session).then(() => finalizePlaybackSession('ended', audio))
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleLoadedMetadata)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleLoadedMetadata)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('ended', handleEnded)
      void finalizePlaybackSession('audio-provider-unmount', audio)
    }
  }, [
    confirmPendingReplayStart,
    confirmQualifiedCycleAndRestart,
    finalizePlaybackSession,
    mediaElement,
    syncSessionFromAudio,
    tracking
  ])

  useEffect(() => {
    if (!autoplayRequestId || !path || !mediaElement) {
      return
    }

    const audio = mediaElement as HTMLAudioElement
    const tryPlay = () => {
      audio.play().catch((error) => {
        console.warn('Auto-play skipped while syncing resumed session:', error?.message || error)
      })
    }

    if (audio.readyState >= 2) {
      tryPlay()
      return
    }

    audio.addEventListener('canplay', tryPlay, { once: true })
    return () => {
      audio.removeEventListener('canplay', tryPlay)
    }
  }, [autoplayRequestId, mediaElement, path])

  return (
    <>
      {children}
      <audio
        ref={attachMediaElement}
        controls
        style={{ display: 'none' }}
        src={path || undefined}
        autoPlay
      />
    </>
  )
}
