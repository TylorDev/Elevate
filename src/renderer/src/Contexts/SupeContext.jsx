import { createContext, useContext, useRef, useEffect, useState } from 'react'
import {
  ElectronGetter,
  electronInvoke,
  ElectronSetter,
  ElectronSetter2,
  WindowsPlayer
} from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'
import { useNavigate } from 'react-router-dom'
import native from 'i/lib/native'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)

  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check

  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [queueState, setQueueState] = useState({
    currentQueue: [],
    originalQueue: [],
    queueName: ''
  })

  const navigate = useNavigate()

  const navigateToResume = (route) => {
    console.error(`La ruta "${route}" no es válida.`)
    navigate(`/${route}/resume`)
  }

  const handleQueueAndPlay = async (song = undefined, index = undefined, filePath) => {
    const invalidRoutes = ['favourites', 'listen-later', 'tracks', 'stats']

    if (invalidRoutes.includes(filePath)) {
      console.log('handleQueueAndPlay[Ruta Invalida]: ', filePath)
      navigateToResume(filePath)
      setCurrentFile(song)
      setCurrentIndex(index)
      return
    }

    try {
      console.log('handleQueueAndPlay[Valida]: ', filePath)
      const newQueue = await window.electron.ipcRenderer.invoke('open-list', filePath)

      if (newQueue) {
        const processedQueue = newQueue.processedData
        setQueueState((prevState) => ({
          queueName: filePath,
          currentQueue: processedQueue,
          originalQueue: processedQueue
        }))

        navigate(`/playlists/${filePath}`)

        if (processedQueue && processedQueue.length > 0) {
          setCurrentFile(song || processedQueue[0])
          setCurrentIndex(index || 0)
        } else {
          console.error('Processed queue is empty')
        }
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error handling queue or file infos:', error)
    }
  }

  const fetchLastData = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('get-last-data')
      if (fileInfos) {
        await handleQueueAndPlay(fileInfos.song, fileInfos.index, fileInfos.queueId)
      }
    } catch (error) {
      console.error('Error fetching last data:', error)
    }
  }

  const saveLastData = async (file, index, queueId) => {
    console.log('Nombre en SaveLastData: ' + (queueId || '[sin nombre]'))
    try {
      await window.electron.ipcRenderer.invoke('save-last-data', file, index, queueId)
    } catch (error) {
      console.error('Error saving last data:', error)
    }
  }

  useEffect(() => {
    if (currentFile && currentIndex !== null) {
      saveLastData(currentFile.filePath, currentIndex, queueState.queueName)
      console.log('Nombre en useEffect: ' + (queueState.queueName || '[sin nombre]'))
    }
  }, [currentIndex, currentFile, queueState.queueName])

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
  }

  const handleNextClick = () => {
    goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
  }

  useEffect(() => {
    fetchLastData()
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

  const handleSaveClick = async () => {
    const paths = queueState.currentQueue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }

  const addhistory = (common) => ElectronSetter('add-history', common)

  const handleSongClick = (file, index, list, name) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueueState({ currentQueue: list, originalQueue: list, queueName: name })
    addhistory(file)
    saveLastData(file.filePath, index, name)
    console.log('Nombre en ClickSong: ' + (name || '[sin nombre]'))
  }

  const handleResume = (list) => {
    setQueueState((prevState) => ({
      ...prevState,
      currentQueue: list,
      originalQueue: list
    }))
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
        handleSaveClick, // guarda la cola actual en la bd.
        handleResume,
        handleQueueAndPlay
      }}
    >
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
