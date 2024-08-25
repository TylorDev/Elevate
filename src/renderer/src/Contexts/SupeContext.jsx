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

  const getLastSong = () => ElectronGetter('get-lastest', setCurrentFile) //0 ref

  useEffect(() => {
    getLastSong()
  }, [])

  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  }

  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  }

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('getbpm', common)

    if (fileInfo) {
      console.log('File info:', fileInfo.bpm)

      // setMetadata((prevMetadata) =>
      //   (prevMetadata || []).map((item) => (item.filePath === fileInfo.filePath ? fileInfo : item))
      // )

      setCurrentFile(fileInfo)
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
      setIsShuffled
    )
  }

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
  }

  const handleNextClick = () => {
    goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
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
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueueState({ currentQueue: list, originalQueue: list })
    addhistory(file)
  }

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.src = currentFile.filePath

      // Manejar eventos de reproducción
      mediaRef.current.onplay = () => {
        setIsPlaying(true)
      }

      mediaRef.current.onpause = () => {
        setIsPlaying(false)
      }
    }
  }, [currentFile?.filePath, currentIndex])

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick)
  }, [currentFile])

  return (
    <SuperContext.Provider
      value={{
        mediaRef, // player
        currentFile, //player
        currentIndex, //player
        isShuffled, //player
        muted, //player
        isPlaying, //player
        loop, //player
        togglePlayPause, //player
        toggleMute, //player
        toggleRepeat, //player
        toggleShuffle, //player
        handlePreviousClick, //player
        handleNextClick, //player
        handleSongClick, // utils
        addhistory, // utils
        handleGetBPMClick, // utils
        queueState, //lista en reproduccion
        handleSaveClick // guarda la cola actual en la bd.
      }}
    >
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
