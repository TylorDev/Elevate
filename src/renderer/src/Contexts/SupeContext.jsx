/* eslint-disable react/prop-types */

import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { ElectronGetter, electronInvoke, ElectronSetter, WindowsPlayer } from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check

  const [queueState, setQueueState] = useState({
    currentQueue: [],
    originalQueue: []
  })
  const Setter = (setter, value) => {
    setter(value)
  }

  const QueueStateSetter = (data) => Setter(setQueueState, data)
  const CurrentFileSetter = (file) => Setter(setCurrentFile, file)
  const CurrentIndexSetter = (index) => Setter(setCurrentIndex, index)
  const IsShuffledSetter = (value) => Setter(setIsShuffled, value)
  const MutedSetter = (value) => Setter(setMuted, value)
  const LoopSetter = (value) => Setter(setLoop, value)
  const IsPlayingSetter = (value) => Setter(setIsPlaying, value)

  const getLastSong = () => ElectronGetter('get-lastest', setCurrentFile) //0 ref

  useEffect(() => {
    getLastSong()
  }, [])

  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, MutedSetter)
  }

  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, LoopSetter)
  }

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('getbpm', common)

    if (fileInfo) {
      console.log('File info:', fileInfo.bpm)

      // setMetadata((prevMetadata) =>
      //   (prevMetadata || []).map((item) => (item.filePath === fileInfo.filePath ? fileInfo : item))
      // )

      CurrentFileSetter(fileInfo)
    }
  }

  const toggleShuffle = () => {
    toShuffle(
      isShuffled,
      queueState.currentQueue,
      queueState.originalQueue,
      currentIndex,
      (newQueue) => {
        setQueueState((prevState) => ({ ...prevState, currentQueue: newQueue }))
      },
      IsShuffledSetter
    )
  }

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queueState.currentQueue, CurrentIndexSetter, CurrentFileSetter)
  }

  const handleNextClick = () => {
    goToNext(currentIndex, queueState.currentQueue, CurrentIndexSetter, CurrentFileSetter)
  }
  const handleSaveClick = async () => {
    const paths = queueState.currentQueue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }

  const addhistory = (common) => ElectronSetter('add-history', common)

  const handleSongClick = (file, index, list) => {
    CurrentFileSetter(file)
    CurrentIndexSetter(index)
    QueueStateSetter({ currentQueue: list, originalQueue: list })
    addhistory(file)
  }

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.src = currentFile.filePath

      // Manejar eventos de reproducción
      mediaRef.current.onplay = () => {
        IsPlayingSetter(true)
      }

      mediaRef.current.onpause = () => {
        IsPlayingSetter(false)
      }
    }
  }, [currentFile.filePath, currentIndex])

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick)
  }, [currentFile])

  return (
    <SuperContext.Provider
      value={{
        mediaRef,
        currentFile,
        CurrentFileSetter,
        currentIndex,
        CurrentIndexSetter,
        isShuffled,
        IsShuffledSetter,
        muted,
        MutedSetter,
        loop,
        LoopSetter,
        isPlaying,
        IsPlayingSetter,
        togglePlayPause,
        toggleMute,
        toggleRepeat,
        handleGetBPMClick,
        toggleShuffle,
        queueState,
        QueueStateSetter,
        handlePreviousClick,
        handleNextClick,
        handleSaveClick,
        handleSongClick,
        addhistory
      }}
    >
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
