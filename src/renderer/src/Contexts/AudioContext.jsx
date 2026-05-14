import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import { useSuper } from './SupeContext'
import { useArgv } from './ArgvContext'

const AudioContextState = createContext(null)
const SHORT_VIEW_MS = 10_000
const SKIP_WINDOW_MS = 30_000

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

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const { currentFile, setCurrentFile, mediaRef, volume, muted, loop } = useSuper()
  const { autoplayRequestId } = useArgv()
  const [path, setPath] = useState(null)
  const playbackSessionRef = useRef(null)
  const currentFileRef = useRef(currentFile)
  const finalizedSessionIdsRef = useRef(new Set())

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

    if (!durationMs || getActiveListeningMs(session) < durationMs * 0.8) {
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

  async function finalizePlaybackSession(reason = 'change', audio = mediaRef.current) {
    const session = playbackSessionRef.current

    if (!session || session.finalized) {
      return
    }

    if (finalizedSessionIdsRef.current.has(session.id)) {
      session.finalized = true
      playbackSessionRef.current = null
      return
    }

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

    const activeListeningSeconds = getActiveListeningMs(session) / 1000
    await recordPlaybackEvent(session, 'playback-finalize', {
      activeListeningSeconds,
      shortViewAwarded: session.shortViewAwarded,
      longViewAwarded: session.longViewAwarded
    })

    finalizedSessionIdsRef.current.add(session.id)
    session.finalized = true
    playbackSessionRef.current = null
  }

  useEffect(() => {
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
    if (!path || !mediaRef.current) {
      return
    }

    const audio = mediaRef.current
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0))
    audio.muted = Boolean(muted)
    audio.loop = Boolean(loop)
  }, [loop, mediaRef, muted, path, volume])

  useEffect(() => {
    if (!mediaRef.current) {
      return
    }

    const audio = mediaRef.current

    const handlePlay = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })
      void evaluateSessionAwards(session)
    }

    const handlePause = () => {
      const session = syncSessionFromAudio(audio)
      stopActiveSegment(session)
      void evaluateSessionAwards(session)
    }

    const handleTimeUpdate = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: true })
      void evaluateSessionAwards(session)
    }

    const handleLoadedMetadata = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
      void evaluateSessionAwards(session)
    }

    const handleSeeked = () => {
      const session = syncSessionFromAudio(audio, { allowSegmentStart: !audio.paused })
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
  }, [mediaRef])

  useEffect(() => {
    if (!autoplayRequestId || !path || !mediaRef.current) {
      return
    }

    const audio = mediaRef.current
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
  }, [autoplayRequestId, path, mediaRef])

  return (
    <AudioContextState.Provider value={{}}>
      {children}
      <audio
        ref={mediaRef}
        controls
        style={{ display: 'none' }}
        src={path}
        autoPlay
      />
    </AudioContextState.Provider>
  )
}
