import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bounce, toast } from 'react-toastify'

import {
  createWeightedShuffledQueue,
  goToNext,
  goToPrevious,
  toShuffle
} from './utilControls'
import { electronInvoke } from './utils'
import { useI18n } from './I18nContext'

const QueueContext = createContext(null)

const EMPTY_QUEUE_STATE = {
  currentQueue: [],
  originalQueue: [],
  queueName: ''
}

function readStorageValue(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
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

function getCurrentQueue(queueState) {
  return Array.isArray(queueState?.currentQueue) ? queueState.currentQueue : []
}

function getOriginalQueue(queueState) {
  const currentQueue = getCurrentQueue(queueState)
  return Array.isArray(queueState?.originalQueue) ? queueState.originalQueue : currentQueue
}

export const QueueProvider = ({ children }) => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [queueState, setQueueState] = useState(() =>
    readStorageValue('queueState', EMPTY_QUEUE_STATE)
  )
  const [currentFile, setCurrentFile] = useState(() => readStorageValue('currentFile', ''))
  const [currentIndex, setCurrentIndex] = useState(() => readStorageValue('currentIndex', 0))
  const [isShuffled, setIsShuffled] = useState(() =>
    readStorageValue('audioControls.shuffled', false)
  )
  const [manualQueueOrders, setManualQueueOrders] = useState(() =>
    readStorageValue('manualQueueOrders', {})
  )

  useEffect(() => {
    localStorage.setItem('queueState', JSON.stringify(queueState))
  }, [queueState])

  useEffect(() => {
    localStorage.setItem('currentFile', JSON.stringify(currentFile))
  }, [currentFile])

  useEffect(() => {
    localStorage.setItem('currentIndex', JSON.stringify(currentIndex))
  }, [currentIndex])

  useEffect(() => {
    localStorage.setItem('audioControls.shuffled', JSON.stringify(isShuffled))
  }, [isShuffled])

  useEffect(() => {
    localStorage.setItem('manualQueueOrders', JSON.stringify(manualQueueOrders))
  }, [manualQueueOrders])

  const resetShuffleState = useCallback(() => {
    setIsShuffled(false)
  }, [])

  const applyBaseQueue = useCallback(
    (list, name, index = null) => {
      const baseQueue = Array.isArray(list) ? [...list] : []
      const hasExplicitIndex =
        index !== null &&
        index !== undefined &&
        Number.isInteger(index) &&
        index >= 0 &&
        baseQueue[index]
      const nextIndex = hasExplicitIndex ? index : 0
      const nextFile = baseQueue[nextIndex] || ''

      resetShuffleState()
      setQueueState({
        currentQueue: baseQueue,
        originalQueue: baseQueue,
        queueName: name
      })
      setCurrentFile(nextFile)
      setCurrentIndex(baseQueue.length > 0 ? nextIndex : 0)
    },
    [resetShuffleState]
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
    [currentFile, currentIndex, isShuffled]
  )

  const PlayQueue = useCallback(
    (list, name, index = null) => {
      applyBaseQueue(list, name, index)
    },
    [applyBaseQueue]
  )

  const playQueueShuffled = useCallback(
    (list, name) => {
      const baseQueue = Array.isArray(list) ? [...list] : []
      const shuffledQueue = createWeightedShuffledQueue(baseQueue)
      const nextFile = shuffledQueue[0] || ''

      setQueueState({
        currentQueue: shuffledQueue,
        originalQueue: baseQueue,
        queueName: name
      })
      setIsShuffled(true)
      setCurrentFile(nextFile)
      setCurrentIndex(0)
    },
    []
  )

  const appendToCurrentQueue = useCallback(
    (song) => {
      if (!song?.filePath) {
        return
      }

      setQueueState((previousState) => {
        const originalQueue = getOriginalQueue(previousState)
        const nextOriginalQueue = [...originalQueue, song]
        const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

        return {
          queueName: previousState?.queueName || 'search-results',
          currentQueue: nextQueue,
          originalQueue: nextOriginalQueue
        }
      })
    },
    [currentFile, isShuffled]
  )

  const appendManyToCurrentQueue = useCallback(
    (songs = []) => {
      const normalizedSongs = Array.isArray(songs) ? songs.filter((song) => song?.filePath) : []

      if (normalizedSongs.length === 0) {
        return
      }

      setQueueState((previousState) => {
        const originalQueue = getOriginalQueue(previousState)
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
    [currentFile, isShuffled]
  )

  const appendToQueueAndPlay = useCallback(
    (song) => {
      if (!song?.filePath) {
        return
      }

      setQueueState((previousState) => {
        const originalQueue = getOriginalQueue(previousState)
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
    [isShuffled]
  )

  const removeFromCurrentQueue = useCallback(
    (index) => {
      setQueueState((previousState) => {
        const currentQueue = getCurrentQueue(previousState)
        const originalQueue = getOriginalQueue(previousState)

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
          const activeIndex = findFileIndex(nextCurrentQueue, currentFile?.filePath)

          if (activeIndex >= 0) {
            setCurrentFile(nextCurrentQueue[activeIndex])
            setCurrentIndex(activeIndex)
          }
        }

        toast.success(t('queue.removed'), {
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
    [currentFile?.filePath, currentIndex, t]
  )

  const openDirectoryQueue = useCallback(
    async (directoryPath, { shouldNavigate = true } = {}) => {
      if (!directoryPath) {
        return []
      }

      const nextQueue = await window.electron.ipcRenderer.invoke(
        'get-audio-in-directory',
        directoryPath
      )

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

  const handleQueueAndPlay = useCallback(
    async (song = undefined, index = undefined, filePath, shouldNavigate = true) => {
      if (!filePath) {
        return
      }

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
    },
    [applyBaseQueue, navigate, openDirectoryQueue]
  )

  const handlePreviousClick = useCallback(() => {
    if (currentIndex > 0) {
      goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }, [currentIndex, queueState.currentQueue])

  const handleNextClick = useCallback(() => {
    if (queueState.currentQueue.length > 0) {
      goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }, [currentIndex, queueState.currentQueue])

  const toggleShuffle = useCallback(() => {
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
  }, [currentFile, isShuffled, navigate, queueState.currentQueue, queueState.originalQueue])

  const removeTrack = useCallback(
    async (playlistPath, index) => {
      const result = await electronInvoke('update-list', {
        filePath: playlistPath,
        index
      })

      if (result && result.success) {
        setQueueState((previousState) => {
          const currentQueue = getCurrentQueue(previousState)
          const originalQueue = getOriginalQueue(previousState)

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
            const activeIndex = findFileIndex(nextCurrentQueue, currentFile?.filePath)

            if (activeIndex >= 0) {
              setCurrentFile(nextCurrentQueue[activeIndex])
              setCurrentIndex(activeIndex)
            }
          }

          return {
            ...previousState,
            currentQueue: nextCurrentQueue,
            originalQueue: nextOriginalQueue
          }
        })

        setTimeout(() => {
          toast.success(t('queue.removed'), {
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
    },
    [currentFile?.filePath, currentIndex, t]
  )

  const addSong = useCallback(
    async (playlistPath, newTrack) => {
      const result = await electronInvoke('add-new-song', {
        filePath: playlistPath,
        song: newTrack.filePath
      })

      if (result && result.success) {
        console.log('M3U file updated successfully at', result.path)
        console.log('New name in db:', result.songName)
        setQueueState((previousState) => {
          const originalQueue = getOriginalQueue(previousState)
          const nextOriginalQueue = [...originalQueue, newTrack]
          const nextQueue = createDisplayedQueue(nextOriginalQueue, isShuffled, currentFile)

          return {
            ...previousState,
            currentQueue: nextQueue,
            originalQueue: nextOriginalQueue
          }
        })
        toast.success(t('queue.songAdded', { name: result.songName }), {
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
    },
    [currentFile, isShuffled, t]
  )

  const handleSongClick = useCallback(
    (file, index, list, name) => {
      applyBaseQueue(list, name, index)
      setCurrentFile(file)
      setCurrentIndex(index)
    },
    [applyBaseQueue]
  )

  const contextValue = useMemo(
    () => ({
      queueState,
      setQueueState,
      currentFile,
      setCurrentFile,
      currentIndex,
      setCurrentIndex,
      isShuffled,
      setIsShuffled,
      manualQueueOrders,
      setManualQueueOrders,
      PlayQueue,
      playQueueShuffled,
      appendToCurrentQueue,
      appendManyToCurrentQueue,
      appendToQueueAndPlay,
      removeFromCurrentQueue,
      reorderCurrentQueue,
      handleNextClick,
      handlePreviousClick,
      toggleShuffle,
      handleSongClick,
      handleQueueAndPlay,
      openDirectoryQueue,
      removeTrack,
      addSong
    }),
    [
      PlayQueue,
      addSong,
      appendManyToCurrentQueue,
      appendToCurrentQueue,
      appendToQueueAndPlay,
      currentFile,
      currentIndex,
      handleNextClick,
      handlePreviousClick,
      handleQueueAndPlay,
      handleSongClick,
      isShuffled,
      manualQueueOrders,
      openDirectoryQueue,
      playQueueShuffled,
      queueState,
      removeFromCurrentQueue,
      removeTrack,
      reorderCurrentQueue,
      toggleShuffle
    ]
  )

  return <QueueContext.Provider value={contextValue}>{children}</QueueContext.Provider>
}

export const useQueue = () => {
  const context = useContext(QueueContext)

  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider')
  }

  return context
}
