import { createContext, useContext, useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { WindowsPlayer } from './utils'
import { useSongCover } from './ImagesContext'
import { extractDominantColor, getContrastColorForBackground } from '../utils/useDominantColor'
import { usePlayback } from './PlaybackContext'
import { useQueue } from './QueueContext'

const SuperContext = createContext()
const AUDIO_STORAGE_KEYS = {
  step: 'audioControls.step'
}
const UI_STORAGE_KEYS = {
  rightClickHintDisabled: 'settings.disableRightClickHint'
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

export const SuperProvider = ({ children }) => {
  const scrollRef = useRef(null)
  const { mediaRef, mediaElement, isPlaying, togglePlayPause } = usePlayback()
  const {
    queueState,
    currentFile,
    currentIndex,
    handlePreviousClick,
    handleNextClick
  } = useQueue()

  const currentCoverUrl = useSongCover(currentFile?.filePath, 'full')
  const previousCoverUrl = useRef('')

  const [isAwaken, setIsAwaken] = useState(false)
  const [isStep, setIsStep] = useState(() => readStoredBoolean(AUDIO_STORAGE_KEYS.step, false))
  const [waveformVariant, setWaveformVariant] = useState(
    () => localStorage.getItem('waveformVariant') || 'mirrored'
  )
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(() =>
    readStoredBoolean('settings.discordRpc', true)
  )
  const [rightClickHintDisabled, setRightClickHintDisabled] = useState(() =>
    readStoredBoolean(UI_STORAGE_KEYS.rightClickHintDisabled, false)
  )

  const handleWaveformVariantChange = (variant) => {
    setWaveformVariant(variant)
    localStorage.setItem('waveformVariant', variant)
  }

  const toggleDiscordRpc = useCallback(() => {
    setDiscordRpcEnabled((prev) => {
      const next = !prev
      localStorage.setItem('settings.discordRpc', JSON.stringify(next))
      if (!next) {
        void window.electron?.discordPresence?.clear?.()
      }
      return next
    })
  }, [])

  const toggleRightClickHintDisabled = useCallback(() => {
    setRightClickHintDisabled((prev) => {
      const next = !prev
      localStorage.setItem(UI_STORAGE_KEYS.rightClickHintDisabled, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.step, JSON.stringify(isStep))
  }, [isStep])

  const handleAwaken = (value) => {
    setIsAwaken(value)
  }

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, currentCoverUrl, handlePreviousClick, handleNextClick)
  }, [currentCoverUrl, currentFile, handleNextClick, handlePreviousClick, mediaElement, mediaRef])

  useEffect(() => {
    void window.electron?.windowControls?.updateTaskbarPlayerState?.({
      isPlaying,
      title: currentFile?.title || currentFile?.fileName || '',
      artist: currentFile?.artist || '',
      hasPrevious: currentIndex > 0,
      hasNext: queueState.currentQueue.length > 0,
      previewMode: 'full-window'
    })
  }, [
    currentFile?.artist,
    currentFile?.fileName,
    currentFile?.title,
    currentIndex,
    isPlaying,
    queueState.currentQueue.length
  ])

  // --- Discord Rich Presence ---
  const playbackStartedAtRef = useRef(null)

  useEffect(() => {
    if (!discordRpcEnabled) {
      playbackStartedAtRef.current = null
      void window.electron?.discordPresence?.clear?.()
      return
    }

    const hasFile = Boolean(currentFile?.filePath)

    if (!hasFile) {
      playbackStartedAtRef.current = null
      void window.electron?.discordPresence?.clear?.()
      return
    }

    if (isPlaying) {
      playbackStartedAtRef.current = Date.now()
    } else {
      playbackStartedAtRef.current = null
    }

    void window.electron?.discordPresence?.update?.({
      title: currentFile?.title || currentFile?.fileName || '',
      artist: currentFile?.artist || '',
      isPlaying,
      startedAt: playbackStartedAtRef.current,
      queueSourceLabel: queueState.queueName || ''
    })
  }, [
    discordRpcEnabled,
    currentFile?.filePath,
    currentFile?.title,
    currentFile?.fileName,
    currentFile?.artist,
    isPlaying,
    queueState.queueName
  ])

  const minVolume = 0.02

  const fadeOut = (fadeDuration) => {
    const interval = 50
    const steps = fadeDuration / interval
    const stepVolume = (mediaRef.current.volume - minVolume) / steps

    let currentStepCount = 0

    const fadeOutInterval = setInterval(() => {
      if (currentStepCount < steps) {
        mediaRef.current.volume -= stepVolume
        if (mediaRef.current.volume < minVolume) {
          mediaRef.current.volume = minVolume
        }
        currentStepCount++
      } else {
        clearInterval(fadeOutInterval)
      }
    }, interval)
  }

  const fadeIn = (fadeDuration) => {
    const interval = 50
    const steps = fadeDuration / interval
    const stepVolume = (1 - mediaRef.current.volume) / steps

    let currentStepCount = 0

    const fadeInInterval = setInterval(() => {
      if (currentStepCount < steps) {
        mediaRef.current.volume += stepVolume
        if (mediaRef.current.volume > 1.0) {
          mediaRef.current.volume = 1.0
        }
        currentStepCount++
      } else {
        clearInterval(fadeInInterval)
      }
    }, interval)
  }

  const toggleStep = () => {
    if (!isStep) {
      setIsStep(true)
      fadeOut(1000)

      setTimeout(() => {
        fadeIn(1000)
        setIsStep(false)
      }, 45000)
    } else {
      fadeIn(1000)
      setIsStep(false)
    }
  }

  useEffect(() => {
    const unsubscribe = window.electron?.windowControls?.onAppCommand?.((command) => {
      if (command === 'previous-track') {
        handlePreviousClick()
        return
      }

      if (command === 'toggle-playback') {
        togglePlayPause()
        return
      }

      if (command === 'next-track') {
        handleNextClick()
        return
      }

      if (command === 'toggle-step') {
        toggleStep()
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [handleNextClick, handlePreviousClick, togglePlayPause, toggleStep])

  const [color, setColor] = useState(() => {
    return localStorage.getItem('colorManual') || ''
  })

  useEffect(() => {
    if (color) {
      document.documentElement.style.setProperty('--Dynamic-color', color)
      document.documentElement.style.setProperty(
        '--activeIcon',
        getContrastColorForBackground(color)
      )
      localStorage.setItem('colorManual', color)
      return
    }

    localStorage.removeItem('colorManual')

    if (
      currentCoverUrl &&
      currentCoverUrl !== previousCoverUrl.current &&
      !currentCoverUrl.includes('svg')
    ) {
      let alive = true
      previousCoverUrl.current = currentCoverUrl
      extractDominantColor(
        currentCoverUrl,
        currentFile?.coverHash || currentFile?.filePath || currentCoverUrl
      )
        .then((dominantColor) => {
          if (alive) {
            document.documentElement.style.setProperty('--Dynamic-color', dominantColor.hex)
            document.documentElement.style.setProperty('--activeIcon', dominantColor.contrastHex)
          }
        })
        .catch((error) => {
          console.error('Error extracting dominant cover color:', error)
        })

      return () => {
        alive = false
      }
    }
  }, [color, currentCoverUrl, currentFile?.coverHash, currentFile?.filePath])

  const handleColorChange = (value) => {
    const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/

    if (hexColorRegex.test(value) || value === '') {
      setColor(value)
    }
  }

  const contextValue = useMemo(
    () => ({
      scrollRef,
      handleColorChange,
      color,
      isAwaken,
      handleAwaken,
      toggleStep,
      isStep,
      waveformVariant,
      handleWaveformVariantChange,
      discordRpcEnabled,
      toggleDiscordRpc,
      rightClickHintDisabled,
      toggleRightClickHintDisabled
    }),
    [
      color,
      isAwaken,
      isStep,
      toggleStep,
      waveformVariant,
      discordRpcEnabled,
      toggleDiscordRpc,
      rightClickHintDisabled,
      toggleRightClickHintDisabled
    ]
  )

  return (
    <SuperContext.Provider value={contextValue}>{children}</SuperContext.Provider>
  )
}

export const useSuper = () => useContext(SuperContext)
