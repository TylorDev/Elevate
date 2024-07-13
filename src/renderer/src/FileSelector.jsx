/* eslint-disable react/prop-types */

import { useState, useEffect, useRef } from 'react'

import Lista from './Lista'
import { AudioPlayer } from './AudioPlayer'
import { SongData } from './SongData'
import { Controls } from './Controls'
import { PlaylistActions } from './PlaylistActions'

const FilePathsComponent = () => {
  const [metadata, setMetadata] = useState(null)
  const [cola, setCola] = useState([])
  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleList = (files) => {
    setMetadata(files)
  }

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
    <div style={{ display: 'flex', width: '100vw', padding: '5rem' }}>
      <PlaylistActions
        selectFiles={selectFiles}
        handleSaveClick={handleSaveClick}
        openM3U={openM3U}
        detectM3U={detectM3U}
        paths={cola}
      />

      <div style={{ maxWidth: '300px' }}>
        <AudioPlayer
          currentFile={currentFile}
          next={handleNextClick}
          previus={handlePreviousClick}
        />
        <h1>Anterior canción</h1>
        <div>
          {metadata && metadata.length > 0
            ? metadata[(currentIndex - 1 + metadata.length) % metadata.length]?.fileName ||
              'Archivo no disponible'
            : 'Archivo no disponible'}
        </div>

        <h1>Siguiente canción</h1>
        <div>
          {metadata && metadata.length > 0
            ? metadata[(currentIndex + 1) % metadata.length]?.fileName || 'Archivo no disponible'
            : 'Archivo no disponible'}
        </div>
      </div>

      <Controls handlePreviousClick={handlePreviousClick} handleNextClick={handleNextClick} />
      {/* <div>
        <Lista
          files={metadata}
          save={handleSaveClick}
          handleSongClick={handleSongClick}
          handleList={handleList}
        />
      </div> */}

      <div>
        <SongData
          metadata={metadata}
          handleSongClick={handleSongClick}
          currentIndex={currentIndex}
        />
      </div>
    </div>
  )
}

export default FilePathsComponent
