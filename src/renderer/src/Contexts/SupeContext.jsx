import { createContext, useContext, useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { dataToImageUrl, electronInvoke, ElectronSetter, WindowsPlayer } from './utils'
import {
  createWeightedShuffledQueue,
  goToNext,
  goToPrevious,
  toPlay,
  toMute,
  toRepeat,
  toShuffle
} from './utilControls'
import { useNavigate } from 'react-router-dom'
import { Bounce, toast } from 'react-toastify'
import { useCoverUrl } from '../hooks/useCoverUrl'
import { extractDominantColor } from '../utils/useDominantColor'
import { useSession } from './SessionContext'

const SuperContext = createContext()
const PlaybackProgressContext = createContext({ progress: 0, duration: 0 })
const AUDIO_STORAGE_KEYS = {
  volume: 'audioControls.volume',
  muted: 'audioControls.muted',
  loop: 'audioControls.loop',
  shuffled: 'audioControls.shuffled',
  step: 'audioControls.step'
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

function findFileIndex(queue, filePath) {
  if (!filePath || !Array.isArray(queue)) {
    return -1
  }

  return queue.findIndex((file) => file?.filePath === filePath)
}

function createDisplayedQueue(baseQueue, shuffledActive, currentFile) {
  const nextBaseQueue = Array.isArray(baseQueue) ? [...baseQueue] : []
  return shuffledActive ? createWeightedShuffledQueue(nextBaseQueue, currentFile) : nextBaseQueue
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

export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const scrollRef = useRef(null)
  const [muted, setMuted] = useState(() => readStoredBoolean(AUDIO_STORAGE_KEYS.muted, false))
  const [loop, setLoop] = useState(() => readStoredBoolean(AUDIO_STORAGE_KEYS.loop, false))
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(() => readStoredNumber(AUDIO_STORAGE_KEYS.volume, 1))
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const {
    queueState,
    setQueueState,
    currentFile,
    setCurrentFile,
    currentIndex,
    setCurrentIndex,
    isShuffled,
    setIsShuffled
  } = useSession()

  const currentCoverUrl = useCoverUrl(currentFile?.filePath, 'full')
  const previousCoverUrl = useRef('')

  const [isAwaken, setIsAwaken] = useState(false)
  const [isStep, setIsStep] = useState(() => readStoredBoolean(AUDIO_STORAGE_KEYS.step, false))
  const [waveformVariant, setWaveformVariant] = useState(
    () => localStorage.getItem('waveformVariant') || 'mirrored'
  )
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(
    () => readStoredBoolean('settings.discordRpc', true)
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

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.volume, JSON.stringify(volume))
  }, [volume])

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.muted, JSON.stringify(muted))
  }, [muted])

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.loop, JSON.stringify(loop))
  }, [loop])

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.shuffled, JSON.stringify(isShuffled))
  }, [isShuffled])

  useEffect(() => {
    localStorage.setItem(AUDIO_STORAGE_KEYS.step, JSON.stringify(isStep))
  }, [isStep])

  const imagesRef = useRef(new Map())

  const handleAwaken = (value) => {
    setIsAwaken(value)
  }

  const getImage = useCallback((name, data) => {
    const existingImage = imagesRef.current.get(name)
    const nextSignature = typeof data === 'string' ? data : data

    if (existingImage?.signature === nextSignature) {
      return existingImage.url
    }

    if (existingImage?.url?.startsWith?.('blob:')) {
      URL.revokeObjectURL(existingImage.url)
    }

    const url = dataToImageUrl(data)
    imagesRef.current.set(name, {
      url,
      signature: nextSignature
    })
    return url
  }, [])

  const navigate = useNavigate()

  const resetReverseState = useCallback(() => {
    setIsShuffled(false)
  }, [setIsShuffled])

  const applyBaseQueue = useCallback(
    (list, name, index = null) => {
      const baseQueue = Array.isArray(list) ? [...list] : []
      const hasExplicitIndex =
        index !== null && index !== undefined && Number.isInteger(index) && index >= 0 && baseQueue[index]
      const nextIndex = hasExplicitIndex ? index : 0
      const nextFile = baseQueue[nextIndex] || ''

      resetReverseState()
      setQueueState({
        currentQueue: baseQueue,
        originalQueue: baseQueue,
        queueName: name
      })
      setCurrentFile(nextFile)
      setCurrentIndex(baseQueue.length > 0 ? nextIndex : 0)
    },
    [resetReverseState, setCurrentFile, setCurrentIndex, setQueueState]
  )

  const reorderCurrentQueue = useCallback(
    (nextBaseQueue) => {
      const baseQueue = Array.isArray(nextBaseQueue) ? [...nextBaseQueue] : []
      const displayedQueue = createDisplayedQueue(baseQueue, isShuffled, currentFile)
      const activeFilePath = currentFile?.filePath
      const activeIndex = findFileIndex(displayedQueue, activeFilePath)

      setQueueState((previousState) => ({
        ...previousState,
        currentQueue: displayedQueue,
        originalQueue: baseQueue
      }))

      if (activeIndex >= 0) {
        setCurrentFile(displayedQueue[activeIndex])
        setCurrentIndex(activeIndex)
        return
      }

      if (displayedQueue.length === 0) {
        setCurrentFile('')
        setCurrentIndex(0)
        return
      }

      const fallbackIndex = Math.max(0, Math.min(currentIndex, displayedQueue.length - 1))
      setCurrentFile(displayedQueue[fallbackIndex])
      setCurrentIndex(fallbackIndex)
    },
    [currentFile?.filePath, currentIndex, isShuffled, setCurrentFile, setCurrentIndex, setQueueState]
  )

  const PlayQueue = (list, name, index = null) => {
    applyBaseQueue(list, name, index)
  }

  const appendToCurrentQueue = useCallback(
    (song) => {
      if (!song?.filePath) {
        return
      }

      setQueueState((previousState) => {
        const currentQueue = Array.isArray(previousState?.currentQueue)
          ? previousState.currentQueue
          : []
        const originalQueue = Array.isArray(previousState?.originalQueue)
          ? previousState.originalQueue
          : currentQueue
        const nextOriginalQueue = [...originalQueue, song]
        const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

        return {
          queueName: previousState?.queueName || 'search-results',
          currentQueue: nextQueue,
          originalQueue: nextOriginalQueue
        }
      })
    },
    [currentFile, isShuffled, setQueueState]
  )

  const appendManyToCurrentQueue = useCallback(
    (songs = []) => {
      const normalizedSongs = Array.isArray(songs)
        ? songs.filter((song) => song?.filePath)
        : []

      if (normalizedSongs.length === 0) {
        return
      }

      setQueueState((previousState) => {
        const currentQueue = Array.isArray(previousState?.currentQueue)
          ? previousState.currentQueue
          : []
        const originalQueue = Array.isArray(previousState?.originalQueue)
          ? previousState.originalQueue
          : currentQueue
        const existingPaths = new Set(originalQueue.map((file) => file?.filePath).filter(Boolean))
        const songsToAppend = normalizedSongs.filter((song) => !existingPaths.has(song.filePath))

        if (songsToAppend.length === 0) {
          return previousState
        }

        const nextOriginalQueue = [...originalQueue, ...songsToAppend]
        const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

        return {
          queueName: previousState?.queueName || 'search-results',
          currentQueue: nextQueue,
          originalQueue: nextOriginalQueue
        }
      })
    },
    [currentFile, isShuffled, setQueueState]
  )

  const appendToQueueAndPlay = useCallback(
    (song) => {
      if (!song?.filePath) {
        return
      }

      setQueueState((previousState) => {
        const currentQueue = Array.isArray(previousState?.currentQueue)
          ? previousState.currentQueue
          : []
        const originalQueue = Array.isArray(previousState?.originalQueue)
          ? previousState.originalQueue
          : currentQueue
        const nextOriginalQueue = [...originalQueue, song]
        const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, song)
        const nextIndex = findFileIndex(nextQueue, song.filePath)

        setCurrentFile(nextQueue[nextIndex] || song)
        setCurrentIndex(nextIndex >= 0 ? nextIndex : 0)

        return {
          queueName: previousState?.queueName || 'search-results',
          currentQueue: nextQueue,
          originalQueue: nextOriginalQueue
        }
      })
    },
    [isShuffled, setCurrentFile, setCurrentIndex, setQueueState]
  )

  const removeFromCurrentQueue = useCallback(
    (index) => {
      setQueueState((previousState) => {
        const currentQueue = Array.isArray(previousState?.currentQueue)
          ? previousState.currentQueue
          : []
        const originalQueue = Array.isArray(previousState?.originalQueue)
          ? previousState.originalQueue
          : currentQueue

        if (!Number.isInteger(index) || index < 0 || index >= currentQueue.length) {
          return previousState
        }

        const removedFile = currentQueue[index]
        const nextCurrentQueue = currentQueue.filter((_, itemIndex) => itemIndex !== index)
        let removedOriginal = false
        const nextOriginalQueue = originalQueue.filter((file) => {
          if (!removedOriginal && file?.filePath === removedFile?.filePath) {
            removedOriginal = true
            return false
          }

          return true
        })

        if (nextCurrentQueue.length === 0) {
          setCurrentFile('')
          setCurrentIndex(0)
        } else if (currentIndex === index) {
          const nextIndex = Math.min(index, nextCurrentQueue.length - 1)
          setCurrentFile(nextCurrentQueue[nextIndex] || '')
          setCurrentIndex(nextIndex)
        } else if (currentIndex > index) {
          const nextIndex = currentIndex - 1
          setCurrentFile(nextCurrentQueue[nextIndex] || nextCurrentQueue[0] || '')
          setCurrentIndex(nextIndex)
        } else {
          const activeFilePath = currentFile?.filePath
          const activeIndex = findFileIndex(nextCurrentQueue, activeFilePath)

          if (activeIndex >= 0) {
            setCurrentFile(nextCurrentQueue[activeIndex])
            setCurrentIndex(activeIndex)
          }
        }

        toast.success('Eliminada correctamente!', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })

        return {
          ...previousState,
          currentQueue: nextCurrentQueue,
          originalQueue: nextOriginalQueue
        }
      })
    },
    [currentFile?.filePath, currentIndex, setCurrentFile, setCurrentIndex, setQueueState]
  )

  const openDirectoryQueue = useCallback(
    async (directoryPath, { shouldNavigate = true } = {}) => {
      if (!directoryPath) {
        return []
      }

      const nextQueue = await window.electron.ipcRenderer.invoke('get-audio-in-directory', directoryPath)

      if (!Array.isArray(nextQueue) || nextQueue.length === 0) {
        return []
      }

      applyBaseQueue(nextQueue, `folder:${directoryPath}`, 0)

      if (shouldNavigate) {
        navigate(`/directories/${encodeURIComponent(directoryPath)}/false`)
      }

      return nextQueue
    },
    [applyBaseQueue, navigate]
  )

  const handleQueueAndPlay = async (song = undefined, index = undefined, filePath, shouldNavigate = true) => {
    if (filePath.startsWith('folder:')) {
      const newFilePath = filePath.replace(/^folder:/, '')
      await openDirectoryQueue(newFilePath, { shouldNavigate })
      if (song?.filePath && typeof index === 'number') {
        setCurrentFile(song)
        setCurrentIndex(index)
      }
      return
    }

    try {
      const newQueue = await window.electron.ipcRenderer.invoke('get-list', filePath)

      if (newQueue) {
        const processedQueue = newQueue.processedData
        const nextIndex = typeof index === 'number' ? index : 0

        applyBaseQueue(processedQueue, filePath, nextIndex)

        if (shouldNavigate) {
          navigate(`/playlists/${filePath}`)
        }

        if (processedQueue && processedQueue.length > 0) {
          setCurrentFile(song || processedQueue[nextIndex] || processedQueue[0])
          setCurrentIndex(nextIndex)
        } else {
          console.error('Processed queue is empty')
        }
      }
    } catch (error) {
      console.error('Error handling queue or file infos:', error)
    }
  }

  const progressRafRef = useRef(null)

  useEffect(() => {
    if (!mediaRef.current) return

    const audio = mediaRef.current

    const updateProgress = () => {
      if (progressRafRef.current) window.cancelAnimationFrame(progressRafRef.current)
      progressRafRef.current = window.requestAnimationFrame(() => {
        setProgress(audio.currentTime)
      })
    }

    const updateDuration = () => {
      setDuration(audio.duration || 0)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => handleNextClick()

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      if (progressRafRef.current) window.cancelAnimationFrame(progressRafRef.current)
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [queueState.currentQueue, currentIndex])

  useEffect(() => {
    if (mediaRef.current) {
      let filePath = currentFile?.filePath
        ? currentFile.filePath.replace(/\\/g, '/').replace(/#/g, '%23')
        : null
      if (filePath && /^([a-zA-Z]):/.test(filePath)) {
        filePath = `file:///${filePath}`
      }
      mediaRef.current.src = filePath || ''
    }
  }, [currentFile?.filePath])

  const handlePreviousClick = useCallback(() => {
    if (currentIndex > 0) {
      goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }, [currentIndex, queueState.currentQueue, setCurrentFile, setCurrentIndex])

  const handleNextClick = useCallback(() => {
    if (queueState.currentQueue.length > 0) {
      goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }, [currentIndex, queueState.currentQueue, setCurrentFile, setCurrentIndex])

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, currentCoverUrl, handlePreviousClick, handleNextClick)
  }, [currentCoverUrl, currentFile, handleNextClick, handlePreviousClick])

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

  const togglePlayPause = useCallback(() => {
    if (!currentFile?.filePath && queueState.currentQueue.length > 0) {
      setCurrentFile(queueState.currentQueue[0])
      setCurrentIndex(0)
    } else {
      toPlay(mediaRef, isPlaying)
    }
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

  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  }

  const setMediaVolume = useCallback((value) => {
    const nextVolume = Math.max(0, Math.min(1, Number(value) || 0))
    setVolume(nextVolume)

    if (mediaRef.current) {
      mediaRef.current.volume = nextVolume
      mediaRef.current.muted = nextVolume === 0
    }

    setMuted(nextVolume === 0)
  }, [])

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

  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  }

  const toggleShuffle = () => {
    toShuffle(
      isShuffled,
      queueState.currentQueue,
      queueState.originalQueue,
      currentFile,
      setQueueState,
      setCurrentFile,
      setCurrentIndex,
      setIsShuffled
    )
    navigate('/music')
  }

  const handleSaveClick = useCallback(async () => {
    const paths = queueState.currentQueue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }, [queueState.currentQueue])

  const removeTrack = useCallback(async (playlistPath, index) => {
    const result = await electronInvoke('update-list', {
      filePath: playlistPath,
      index
    })

    if (result && result.success) {
      setQueueState((prevState) => ({
        ...prevState,
        currentQueue: prevState.currentQueue.filter((_, itemIndex) => itemIndex !== index)
      }))

      setTimeout(() => {
        toast.success('Eliminada correctamente!', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })
      }, 1000)
    }
  }, [setQueueState])

  const addSong = useCallback(async (playlistPath, newTrack) => {
    const result = await electronInvoke('add-new-song', {
      filePath: playlistPath,
      song: newTrack.filePath
    })

    if (result && result.success) {
      console.log('M3U file updated successfully at', result.path)
      console.log('New name in db:', result.songName)
      setQueueState((prevState) => ({
        ...prevState,
        currentQueue: [...prevState.currentQueue, newTrack]
      }))
      toast.success(`Agregada: ${result.songName}`, {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })
    }
  }, [setQueueState])

  const addhistory = useCallback((common) => ElectronSetter('add-history', common), [])

  const handleSongClick = useCallback(
    (file, index, list, name) => {
      applyBaseQueue(list, name, index)
      setCurrentFile(file)
      setCurrentIndex(index)
    },
    [applyBaseQueue, setCurrentFile, setCurrentIndex]
  )

  const [color, setColor] = useState(() => {
    return localStorage.getItem('colorManual') || ''
  })

  const [currentBackground, setCurrentBackground] = useState(null)
  const [backgroundHistory, setBackgroundHistory] = useState([])
  const [backgroundLoading, setBackgroundLoading] = useState(true)

  useEffect(() => {
    if (color) {
      document.documentElement.style.setProperty('--text-principal', color)
      localStorage.setItem('colorManual', color)
      return
    }

    localStorage.removeItem('colorManual')

    if (currentCoverUrl && currentCoverUrl !== previousCoverUrl.current && !currentCoverUrl.includes('svg')) {
      let alive = true
      previousCoverUrl.current = currentCoverUrl
      extractDominantColor(currentCoverUrl)
        .then((dominantColor) => {
          if (alive) {
            document.documentElement.style.setProperty('--text-principal', dominantColor.hex)
          }
        })
        .catch((error) => {
          console.error('Error extracting dominant cover color:', error)
        })

      return () => {
        alive = false
      }
    }
  }, [color, currentCoverUrl])

  const handleColorChange = (value) => {
    const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/

    if (hexColorRegex.test(value) || value === '') {
      setColor(value)
    }
  }

  const applyBackgroundState = useCallback((state) => {
    const items = Array.isArray(state?.items) ? state.items : []
    const current =
      state?.current && typeof state.current === 'object'
        ? state.current
        : items.find((item) => item?.id && item.id === state?.currentBackgroundId) || null

    setCurrentBackground(current || null)
    setBackgroundHistory(items)
  }, [])

  const refreshBackgroundHistory = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const state = await window.electron.backgroundImages.list()
      applyBackgroundState(state)
      return state
    } catch (error) {
      console.error('Error loading background history:', error)
      return null
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  useEffect(() => {
    let alive = true

    const initializeBackgroundHistory = async () => {
      setBackgroundLoading(true)

      try {
        const legacyBackground = localStorage.getItem('backgroundImageUrl')
        let state = null

        if (legacyBackground) {
          const migrationResult = await window.electron.backgroundImages.migrateLegacy(legacyBackground)
          if (migrationResult?.success !== false) {
            localStorage.removeItem('backgroundImageUrl')
            state = migrationResult
          }
        }

        if (!state) {
          state = await window.electron.backgroundImages.list()
        }

        if (alive) {
          applyBackgroundState(state)
        }
      } catch (error) {
        console.error('Error initializing background history:', error)
      } finally {
        if (alive) {
          setBackgroundLoading(false)
        }
      }
    }

    void initializeBackgroundHistory()

    return () => {
      alive = false
    }
  }, [applyBackgroundState])

  const applyRemoteBackground = useCallback(async (url) => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.applyRemote(url)
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error applying remote background:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al aplicar la imagen remota.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const pickLocalBackground = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.applyLocal()
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error applying local background:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al seleccionar la imagen local.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const selectBackgroundFromHistory = useCallback(async (id) => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.select(id)
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error selecting background history item:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al reutilizar la imagen del historial.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const removeBackgroundHistoryItem = useCallback(async (id) => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.remove(id)
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error removing background history item:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al eliminar la imagen del historial.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const clearBackground = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.clearCurrent()
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error clearing background:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al limpiar el fondo.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const backgroundImageUrl = currentBackground?.resolvedUrl || ''

  const handleTimelineClick = (event) => {
    const timeline = event.currentTarget

    if (!timeline || !mediaRef.current) return

    const timelineWidth = timeline.clientWidth
    const clickPosition = Math.max(0, Math.min(event.nativeEvent.offsetX, timelineWidth))
    const mediaDuration = mediaRef.current.duration || 0
    const newTime = (clickPosition / timelineWidth) * mediaDuration

    mediaRef.current.currentTime = newTime
  }

  const playbackProgressValue = useMemo(
    () => ({
      progress,
      duration
    }),
    [duration, progress]
  )

  const contextValue = useMemo(() => ({
    mediaRef,
    currentFile,
    setCurrentFile,
    currentIndex,
    setCurrentIndex,
    isShuffled,
    muted,
    volume,
    setVolume,
    setMediaVolume,
    isPlaying,
    loop,
    togglePlayPause,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    handlePreviousClick,
    handleNextClick,
    handleSongClick,
    reorderCurrentQueue,
    appendToCurrentQueue,
    appendManyToCurrentQueue,
    appendToQueueAndPlay,
    removeFromCurrentQueue,
    addhistory,
    queueState,
    handleSaveClick,
    handleQueueAndPlay,
    openDirectoryQueue,
    PlayQueue,
    removeTrack,
    addSong,
    handleTimelineClick,
    scrollRef,
    getImage,
    handleColorChange,
    color,
    isAwaken,
    handleAwaken,
    toggleStep,
    isStep,
    currentBackground,
    backgroundImageUrl,
    backgroundHistory,
    backgroundLoading,
    applyRemoteBackground,
    pickLocalBackground,
    selectBackgroundFromHistory,
    removeBackgroundHistoryItem,
    clearBackground,
    refreshBackgroundHistory,
    waveformVariant,
    handleWaveformVariantChange,
    discordRpcEnabled,
    toggleDiscordRpc
  }), [
    addhistory,
    addSong,
    appendToCurrentQueue,
    appendManyToCurrentQueue,
    appendToQueueAndPlay,
    applyRemoteBackground,
    backgroundHistory,
    backgroundImageUrl,
    backgroundLoading,
    clearBackground,
    color,
    currentFile,
    currentBackground,
    currentIndex,
    getImage,
    handleNextClick,
    handlePreviousClick,
    handleQueueAndPlay,
    handleSongClick,
    isAwaken,
    isPlaying,
    isShuffled,
    isStep,
    loop,
    muted,
    openDirectoryQueue,
    pickLocalBackground,
    queueState,
    refreshBackgroundHistory,
    reorderCurrentQueue,
    removeBackgroundHistoryItem,
    removeFromCurrentQueue,
    removeTrack,
    selectBackgroundFromHistory,
    setCurrentFile,
    setCurrentIndex,
    setMediaVolume,
    toggleMute,
    togglePlayPause,
    toggleRepeat,
    toggleShuffle,
    toggleStep,
    volume,
    waveformVariant,
    discordRpcEnabled,
    toggleDiscordRpc
  ])

  return (
    <PlaybackProgressContext.Provider value={playbackProgressValue}>
      <SuperContext.Provider value={contextValue}>{children}</SuperContext.Provider>
    </PlaybackProgressContext.Provider>
  )
}

export const useSuper = () => useContext(SuperContext)
export const usePlaybackProgress = () => useContext(PlaybackProgressContext)
