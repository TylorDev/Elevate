/* eslint-disable react/prop-types */

import { useState, useEffect } from 'react'

import { AudioPlayer } from './AudioPlayer'

import { PlaylistActions } from './PlaylistActions'
import { Cola } from './Cola'

const FilePathsComponent = () => {
  const [metadata, setMetadata] = useState(null)
  const [cola, setCola] = useState([])
  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

  const handlePreviousClick = () => {
    // Mover al final si estamos en el inicio de la lista
    const newIndex = currentIndex === 0 ? metadata.length - 1 : currentIndex - 1
    setCurrentIndex(newIndex)
    setCurrentFile(metadata[newIndex])
  }

  const handleNextClick = () => {
    // Mover al inicio si estamos al final de la lista
    const newIndex = currentIndex === metadata.length - 1 ? 0 : currentIndex + 1
    setCurrentIndex(newIndex)
    setCurrentFile(metadata[newIndex])
  }

  const handleSaveClick = async (paths = null) => {
    // Si no se proporcionaron rutas, usar las rutas de metadata
    if (!paths) {
      paths = metadata.map((file) => file.filePath)
    }

    // Enviar las rutas al backend para guardar como archivo M3U
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

  const handleSongClick = (file, index) => {
    setCurrentFile(file)
    setCurrentIndex(index)
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
    <div>
      <PlaylistActions
        selectFiles={selectFiles}
        handleSaveClick={handleSaveClick}
        openM3U={openM3U}
        detectM3U={detectM3U}
        paths={cola}
      />

      <AudioPlayer currentFile={currentFile} next={handleNextClick} previus={handlePreviousClick} />

      <Cola metadata={metadata} handleSongClick={handleSongClick} currentIndex={currentIndex} />
    </div>
  )
}

export default FilePathsComponent
