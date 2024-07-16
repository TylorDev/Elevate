/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react'

// Crea el contexto
const AppContext = createContext()

// Crea un proveedor de contexto
export const AppProvider = ({ children }) => {
  const [metadata, setMetadata] = useState(null)
  const [cola, setCola] = useState([])
  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [emptyList, setEmptyList] = useState([])
  const [queue, setQueue] = useState('tracks')

  const addItemToEmptyList = (item) => {
    setEmptyList([...emptyList, item])
  }

  const handleSongClick = (file, index, name) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(name)
  }

  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

  const handlePreviousClick = (list) => {
    const newIndex = currentIndex === 0 ? list.length - 1 : currentIndex - 1
    setCurrentIndex(newIndex)
    setCurrentFile(list[newIndex])
  }

  const handleNextClick = (list) => {
    const newIndex = currentIndex === list.length - 1 ? 0 : currentIndex + 1
    setCurrentIndex(newIndex)
    setCurrentFile(list[newIndex])
  }

  const handleGetBPMClick = async (filePath, common) => {
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('getbpm', filePath, common)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error getting BPM:', error)
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
        detectM3U
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
