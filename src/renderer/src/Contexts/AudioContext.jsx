import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import { useArgv } from './ArgvContext'
import { usePlayback } from './PlaybackContext'
import { useQueue } from './QueueContext'

const SHORT_VIEW_MS = 10_000
const SKIP_WINDOW_MS = 30_000
const LONG_VIEW_COMPLETION_THRESHOLD = 0.7
const REPLAY_RESTART_THRESHOLD = 0.16
const REPLAY_WRAP_BACKTRACK_MS = 1_500

const TOAST_OPTIONS = {
  position: 'bottom-right',
  autoClose: 1400,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'dark'
}

export const AudioProvider = ({ children }) => {
  const { currentFile, setCurrentFile } = useQueue()
  const { mediaRef, mediaElement, volume, muted, loop, attachMediaElement } = usePlayback()
  const { autoplayRequestId } = useArgv()
  const [path, setPath] = useState(null)
  const playbackSessionRef = useRef(null)
  const pendingReplayRef = useRef(null)
  const currentFileRef = useRef(currentFile)

  useEffect(() => {
    currentFileRef.current = currentFile
  }, [currentFile])

  function sanitizePath(filePath) {
    if (!filePath) return null
    let nextPath = filePath.replace(/\\/g, '/').replace(/#/g, '%23')
    if (/^([a-zA-Z]):/.test(nextPath)) {
      nextPath = `file:///${nextPath}`
    }
    return nextPath
  }

  function mergeCurrentFileStats(filePath, stats) {
    if (!stats) {
      return
    }

    setCurrentFile((activeFile) => {
      if (!activeFile || activeFile.filePath !== filePath) {
        return activeFile
      }

      return {
        ...activeFile,
        ...stats
      }
    })
  }

  function openPlaybackSession(file) {
    if (!file?.filePath) {
      return null
    }

    const session = {
      id: `${file.filePath}|${Date.now()}`,
      file,
      duration: Math.max(0, Number(file.duration) || 0),
      activeListeningMs: 0,
      activeSegmentStartedAt: null,
      lastKnownCurrentTime: 0,
      shortViewAwarded: false,
      longViewAwarded: false,
      skipAwarded: false,
      finalizing: false,
      finalized: false
    }

    playbackSessionRef.current = session
    return session
  }

  function ensureSession() {
    return playbackSessionRef.current || openPlaybackSession(currentFileRef.current)
  }

  function getActiveListeningMs(session, now = Date.now()) {
    if (!session) {
      return 0
    }

    if (session.activeSegmentStartedAt == null) {
      return session.activeListeningMs
    }

    return session.activeListeningMs + Math.max(0, now - session.activeSegmentStartedAt)
  }

  function startActiveSegment(session, now = Date.now()) {
    if (!session || session.finalized || session.activeSegmentStartedAt != null) {
      return
    }

    session.activeSegmentStartedAt = now
  }

  function stopActiveSegment(session, now = Date.now()) {
    if (!session || session.activeSegmentStartedAt == null) {
      return
    }

    session.activeListeningMs += Math.max(0, now - session.activeSegmentStartedAt)
    session.activeSegmentStartedAt = null
  }

  function getRestartThresholdTime(durationSeconds) {
    return Math.max(0, Number(durationSeconds) || 0) * REPLAY_RESTART_THRESHOLD
  }

  function isReplayStartPosition(currentTime, durationSeconds) {
    const thresholdTime = getRestartThresholdTime(durationSeconds)
    return thresholdTime > 0 && Math.max(0, Number(currentTime) || 0) <= thresholdTime
  }

  function resetCycleState(session, audio = mediaRef.current) {
    if (!session) {
      return
    }

    const now = Date.now()
    const currentTime = Math.max(0, Number(audio?.currentTime) || 0)

    session.activeListeningMs = 0
    session.activeSegmentStartedAt = audio && !audio.paused ? now : null
    session.lastKnownCurrentTime = currentTime
    session.shortViewAwarded = false
    session.longViewAwarded = false
    session.skipAwarded = false
    session.finalizing = false
  }

  async function recordPlaybackEvent(session, eventType, extra = {}) {
    if (!session?.file?.filePath) {
      return null
    }

    try {
      const result = await window.electron?.ipcRenderer?.invoke('playback:record', {
        eventType,
        filePath: session.file.filePath,
        fileName: session.file.fileName || session.file.title || '',
        duration: Math.max(0, Number(session.duration) || 0),
        ...extra
      })

      if (result?.success && result?.stats) {
        mergeCurrentFileStats(session.file.filePath, result.stats)
      }

      return result
    } catch (error) {
      console.error(`Error recording playback event "${eventType}":`, error)
      return null
    }
  }

  async function maybeAwardShortView(session) {
    if (!session || session.shortViewAwarded || session.finalized) {
      return
    }

    if (getActiveListeningMs(session) < SHORT_VIEW_MS) {
      return
    }

    const result = await recordPlaybackEvent(session, 'short-view-award')

    if (!result?.success) {
      return
    }

    session.shortViewAwarded = true
    toast.success('+1 short views', TOAST_OPTIONS)
  }

  async function maybeAwardLongView(session) {
    if (!session || session.longViewAwarded || session.finalized) {
      return
    }

    const durationMs = Math.max(0, Number(session.duration) || 0) * 1000

    if (!durationMs || getActiveListeningMs(session) < durationMs * LONG_VIEW_COMPLETION_THRESHOLD) {
      return
    }

    const result = await recordPlaybackEvent(session, 'long-view-award')

    if (!result?.success) {
      return
    }

    session.longViewAwarded = true
    toast.success('+1 long views', TOAST_OPTIONS)
  }

  async function evaluateSessionAwards(session) {
    if (!session || session.finalized) {
      return
    }

    await maybeAwardShortView(session)
    await maybeAwardLongView(session)
  }

  async function finalizeCycleSnapshot(session, countAsRepeat = false) {
    if (!session) {
      return null
    }

    const activeListeningSeconds = getActiveListeningMs(session) / 1000

    return recordPlaybackEvent(session, 'playback-finalize', {
      activeListeningSeconds,
      shortViewAwarded: session.shortViewAwarded,
      longViewAwarded: session.longViewAwarded,
      countAsRepeat
    })
  }

  function syncSessionFromAudio(audio, { allowSegmentStart = false } = {}) {
    const session = ensureSession()

    if (!session || session.finalized || !audio) {
      return null
    }

    const now = Date.now()
    session.duration = Math.max(
      0,
      Number(audio.duration) || Number(session.file?.duration) || Number(session.duration) || 0
    )
    session.lastKnownCurrentTime = Math.max(0, Number(audio.currentTime) || 0)

    if (allowSegmentStart && !audio.paused) {
      startActiveSegment(session, now)
    }

    return session
  }

  async function confirmQualifiedCycleAndRestart(_trigger, audio = mediaRef.current) {
    const session = playbackSessionRef.current

    if (!session || session.finalized || session.finalizing || !session.longViewAwarded) {
      return false
    }

    session.finalizing = true
    syncSessionFromAudio(audio)
    stopActiveSegment(session)

    const result = await finalizeCycleSnapshot(session, true)

    if (!result?.success) {
      session.finalizing = false
      if (audio && !audio.paused) {
        startActiveSegment(session)
      }
      return false
    }

    pendingReplayRef.current = null
    resetCycleState(session, audio)
    return true
  }

  async function confirmPendingReplayStart(audio = mediaRef.current) {
    const pendingReplay = pendingReplayRef.current
    const activeFilePath = currentFileRef.current?.filePath

    if (!pendingReplay || !activeFilePath || pendingReplay.filePath !== activeFilePath) {
      return false
    }

    const currentTime = Math.max(0, Number(audio?.currentTime) || 0)
    const durationSeconds = Math.max(0, Number(audio?.duration) || Number(currentFileRef.current?.duration) || 0)

    if (!isReplayStartPosition(currentTime, durationSeconds)) {
      return false
    }

    const session = playbackSessionRef.current || ensureSession()

    if (!session || session.finalized || session.finalizing) {
      return false
    }

    session.finalizing = true

    const result = await recordPlaybackEvent(session, 'playback-finalize', {
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
    resetCycleState(session, audio)
    return true
  }

  async function finalizePlaybackSession(reason = 'change', audio = mediaRef.current) {
    const session = playbackSessionRef.current

    if (!session || session.finalized || session.finalizing) {
      return
    }

    session.finalizing = true

    syncSessionFromAudio(audio)
    stopActiveSegment(session)
    await evaluateSessionAwards(session)

    const shouldAwardSkip =
      !session.skipAwarded &&
      !session.longViewAwarded &&
      reason !== 'ended' &&
      getActiveListeningMs(session) < SKIP_WINDOW_MS

    if (shouldAwardSkip) {
      const skipResult = await recordPlaybackEvent(session, 'skip-award')
      if (skipResult?.success) {
        session.skipAwarded = true
      }
    }

    const result = await finalizeCycleSnapshot(session, false)
    session.finalizing = false

    if (!result?.success) {
      return
    }

    pendingReplayRef.current =
      reason === 'ended' && session.longViewAwarded
        ? { filePath: session.file.filePath }
        : null
    session.finalized = true
    playbackSessionRef.current = null
  }

  useEffect(() => {
    if (pendingReplayRef.current && pendingReplayRef.current.filePath !== currentFile?.filePath) {
      pendingReplayRef.current = null
    }

    if (currentFile?.filePath) {
      setPath(sanitizePath(currentFile.filePath))
      openPlaybackSession(currentFile)
    } else {
      setPath(null)
    }

    return () => {
      void finalizePlaybackSession('track-change')
    }
  }, [currentFile?.filePath])

  useEffect(() => {
    if (!path || !mediaElement) {
      return
    }

    const audio = mediaElement
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0))
    audio.muted = Boolean(muted)
    audio.loop = Boolean(loop)
  }, [loop, mediaElement, muted, path, volume])

  useEffect(() => {
    if (!mediaElement) {
      return
    }

    const audio = mediaElement

    const handlePlay = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })
      void (async () => {
        await confirmPendingReplayStart(audio)
        await evaluateSessionAwards(playbackSessionRef.current || session)
      })()
    }

    const handlePause = () => {
      const session = syncSessionFromAudio(audio)
      stopActiveSegment(session)
      void evaluateSessionAwards(session)
    }

    const handleTimeUpdate = () => {
      const previousSession = playbackSessionRef.current
      const previousTime = Math.max(0, Number(previousSession?.lastKnownCurrentTime) || 0)
      const currentTime = Math.max(0, Number(audio.currentTime) || 0)
      const durationSeconds = Math.max(0, Number(audio.duration) || Number(previousSession?.duration) || 0)
      const didWrapToReplayStart =
        Boolean(previousSession?.longViewAwarded) &&
        previousTime - currentTime >= REPLAY_WRAP_BACKTRACK_MS / 1000 &&
        isReplayStartPosition(currentTime, durationSeconds)

      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })

      if (didWrapToReplayStart) {
        void confirmQualifiedCycleAndRestart('autoloop', audio)
        return
      }

      void evaluateSessionAwards(session)
    }

    const handleLoadedMetadata = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
      void evaluateSessionAwards(session)
    }

    const handleSeeked = () => {
      const sessionBeforeSeek = playbackSessionRef.current
      const previousTime = Math.max(0, Number(sessionBeforeSeek?.lastKnownCurrentTime) || 0)
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
      const currentTime = Math.max(0, Number(audio.currentTime) || 0)
      const durationSeconds = Math.max(0, Number(audio.duration) || Number(session?.duration) || 0)
      const didReplaySeek =
        Boolean(sessionBeforeSeek?.longViewAwarded) &&
        previousTime > currentTime &&
        isReplayStartPosition(currentTime, durationSeconds)

      if (didReplaySeek) {
        void confirmQualifiedCycleAndRestart('seek-back', audio)
        return
      }

      void evaluateSessionAwards(session)
    }

    const handleEnded = () => {
      const session = syncSessionFromAudio(audio)
      stopActiveSegment(session)
      void evaluateSessionAwards(session).then(() => finalizePlaybackSession('ended', audio))
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
  }, [mediaElement])

  useEffect(() => {
    if (!autoplayRequestId || !path || !mediaElement) {
      return
    }

    const audio = mediaElement
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
  }, [autoplayRequestId, path, mediaElement])

  return (
    <>
      {children}
      <audio
        ref={attachMediaElement}
        controls
        style={{ display: 'none' }}
        src={path}
        autoPlay
      />
    </>
  )
}
