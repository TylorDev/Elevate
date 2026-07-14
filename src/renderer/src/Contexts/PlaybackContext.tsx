import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useQueue } from './QueueContext'
import { toMute, toPlay, toRepeat } from './utilControls'

const PlaybackContext = createContext(null)

const PLAYBACK_STORAGE_KEYS = {
  volume: 'audioControls.volume',
  muted: 'audioControls.muted',
  loop: 'audioControls.loop'
}

function readStoredBoolean(key, fallback = false) {
  try {
    const value = localStorage.getItem(key)

    if (value == null) {
      return fallback
    }

    const parsed = JSON.parse(value)
    return typeof parsed === 'boolean' ? parsed : fallback
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error)
    return fallback
  }
}

function readStoredNumber(key, fallback = 0) {
  try {
    const value = localStorage.getItem(key)

    if (value == null) {
      return fallback
    }

    const parsed = JSON.parse(value)
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
      return fallback
    }

    return Math.max(0, Math.min(1, parsed))
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error)
    return fallback
  }
}

function isEditableElement(element) {
  const HTMLElementCtor = globalThis?.HTMLElement

  if (!HTMLElementCtor || !(element instanceof HTMLElementCtor)) {
    return false
  }

  const tagName = element.tagName?.toLowerCase()

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  return element.isContentEditable
}

export const PlaybackProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const [mediaElement, setMediaElement] = useState(null)
  const [muted, setMuted] = useState(() => readStoredBoolean(PLAYBACK_STORAGE_KEYS.muted, false))
  const [loop, setLoop] = useState(() => readStoredBoolean(PLAYBACK_STORAGE_KEYS.loop, false))
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(() => readStoredNumber(PLAYBACK_STORAGE_KEYS.volume, 1))
  const { queueState, currentFile, setCurrentFile, setCurrentIndex, handleNextClick } = useQueue()

  const attachMediaElement = useCallback((element) => {
    mediaRef.current = element
    setMediaElement(element)
  }, [])

  useEffect(() => {
    localStorage.setItem(PLAYBACK_STORAGE_KEYS.volume, JSON.stringify(volume))
  }, [volume])

  useEffect(() => {
    localStorage.setItem(PLAYBACK_STORAGE_KEYS.muted, JSON.stringify(muted))
  }, [muted])

  useEffect(() => {
    localStorage.setItem(PLAYBACK_STORAGE_KEYS.loop, JSON.stringify(loop))
  }, [loop])

  useEffect(() => {
    if (!mediaElement) return

    const audio = mediaElement
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => handleNextClick()

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [handleNextClick, mediaElement])

  const togglePlayPause = useCallback(() => {
    if (!currentFile?.filePath && queueState.currentQueue.length > 0) {
      setCurrentFile(queueState.currentQueue[0])
      setCurrentIndex(0)
      return
    }

    toPlay(mediaRef, isPlaying)
  }, [currentFile?.filePath, isPlaying, queueState.currentQueue, setCurrentFile, setCurrentIndex])

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) {
        return
      }

      if (isEditableElement(document.activeElement)) {
        return
      }

      event.preventDefault()
      togglePlayPause()
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [togglePlayPause])

  const toggleMute = useCallback(() => {
    toMute(mediaRef, muted, setMuted)
  }, [muted])

  const toggleRepeat = useCallback(() => {
    toRepeat(mediaRef, loop, setLoop)
  }, [loop])

  const setMediaVolume = useCallback((value) => {
    const nextVolume = Math.max(0, Math.min(1, Number(value) || 0))
    setVolume(nextVolume)

    if (mediaRef.current) {
      mediaRef.current.volume = nextVolume
      mediaRef.current.muted = nextVolume === 0
    }

    setMuted(nextVolume === 0)
  }, [])

  const contextValue = useMemo(
    () => ({
      mediaRef,
      mediaElement,
      isPlaying,
      muted,
      volume,
      loop,
      togglePlayPause,
      toggleMute,
      toggleRepeat,
      setMediaVolume,
      attachMediaElement
    }),
    [
      attachMediaElement,
      isPlaying,
      loop,
      mediaElement,
      muted,
      setMediaVolume,
      toggleMute,
      togglePlayPause,
      toggleRepeat,
      volume
    ]
  )

  return <PlaybackContext.Provider value={contextValue}>{children}</PlaybackContext.Provider>
}

export const usePlayback = () => {
  const context = useContext(PlaybackContext)

  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider')
  }

  return context
}
