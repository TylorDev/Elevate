/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useRef } from 'react'

// Crea el contexto
const AppContext = createContext()

// Crea un proveedor de contexto
export const AppProvider = ({ children }) => {
  const [metadata, setMetadata] = useState(null)
  const [cola, setCola] = useState([])
  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [emptyList, setEmptyList] = useState([])
  const [queue, setQueue] = useState([])
  const [likes, setLikes] = useState([])
  const [later, setLater] = useState([])
  const addItemToEmptyList = (item) => {
    setEmptyList([...emptyList, item])
  }

  const handleSongClick = (file, index, list) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(list)
  }

  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

  const handlePreviousClick = () => {
    const newIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1
    setCurrentIndex(newIndex)
    setCurrentFile(queue[newIndex])
  }

  const handleNextClick = () => {
    const newIndex = currentIndex === queue.length - 1 ? 0 : currentIndex + 1
    setCurrentIndex(newIndex)
    setCurrentFile(queue[newIndex])
  }

  const handleGetBPMClick = async (filePath, common) => {
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('getbpm', filePath, common)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error getting BPM:', error)
    }
  }

  const likesong = async (common) => {
    const { filePath, fileName } = common
    console.log(filePath, fileName)
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('like-song', filePath, fileName)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const unlikesong = async (common) => {
    const { filePath } = common
    console.log(filePath)
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('unlike-song', filePath)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const getlikes = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('get-likes')
      if (fileInfos) {
        setLikes(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const latersong = async (common) => {
    const { filePath, fileName } = common
    console.log(filePath, fileName)
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke(
        'listen-later-song',
        filePath,
        fileName
      )
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const removelatersong = async (common) => {
    const { filePath } = common
    console.log(filePath)
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('remove-listen-later', filePath)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const getlatersongs = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('get-listen-later')
      if (fileInfos) {
        setLater(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const handleSaveClick = async (paths = null) => {
    if (!paths) {
      paths = metadata.map((file) => file.filePath)
    }

    try {
      const result = await window.electron.ipcRenderer.invoke('save-m3u', paths)
      if (result.success) {
        console.log('M3U file saved successfully at', result.path)
      } else {
        console.error('Failed to save M3U file:', result.error)
      }
    } catch (error) {
      console.error('Error communicating with main process:', error)
    }
  }

  const selectFiles = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('select-files')
      if (fileInfos) {
        setMetadata(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const openM3U = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('open-m3u')
      if (fileInfos) {
        setMetadata(fileInfos)
        console.log(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const detectM3U = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('detect-m3u')
      if (fileInfos) {
        setMetadata(fileInfos)
        console.log(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const BinToBlob = (img, mimeType = 'image/png') => {
    if (img && img.data && img.type !== 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      return url
    }
    return 'https://i.pinimg.com/736x/ef/23/25/ef2325cedb047b8ac24fc2b718c15a30.jpg'
  }

  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRef = useRef(null)

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
  }, [currentFile.filePath])

  const togglePlayPause = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
      } else {
        mediaRef.current.play()
      }
    }
  }

  return (
    <AppContext.Provider
      value={{
        metadata,
        cola,
        currentFile,
        currentIndex,
        emptyList,
        queue,
        addItemToEmptyList,
        handleSongClick,
        handlePreviousClick,
        handleNextClick,
        handleGetBPMClick,
        handleSaveClick,
        selectFiles,
        openM3U,
        detectM3U,
        BinToBlob,
        mediaRef,
        isPlaying,
        togglePlayPause,

        likesong,
        getlikes,
        unlikesong,
        likes,
        latersong,
        removelatersong,
        getlatersongs,
        later
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// Hook personalizado para usar el contexto
export const useAppContext = () => {
  return useContext(AppContext)
}
