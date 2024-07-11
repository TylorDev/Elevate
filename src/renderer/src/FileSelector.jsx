/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { useState, useEffect, useRef } from 'react'

import Lista from './Lista'

const FilePathsComponent = () => {
  // const [filepath, setFilePath] = useState('')
  // const [metadata, setMetadata] = useState(null)
  // const [loading, setLoading] = useState(false)

  // const handleButtonClick = async () => {
  //   setLoading(true)
  //   try {
  //     const path = await window.electron.ipcRenderer.invoke('select-file')
  //     setFilePath(path)
  //     console.log(path)
  //   } catch (error) {
  //     console.error('Error fetching file paths:', error)
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  // const getMetadata = async () => {
  //   if (!filepath) return
  //   setLoading(true)
  //   try {
  //     const fileInfo = await window.electron.ipcRenderer.invoke('get-file-info', filepath)
  //     setMetadata(fileInfo)
  //   } catch (error) {
  //     console.error('Error fetching file info:', error)
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const [metadata, setMetadata] = useState(null)

  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  // const [filePaths, setFilePaths] = useState([])

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

  // useEffect(() => {
  //   // Asegúrate de que metadata no sea undefined o null
  //   if (metadata && Array.isArray(metadata)) {
  //     const paths = metadata.map((file) => file.filePath)
  //     setFilePaths(paths)
  //   }
  // }, [metadata]) // El efecto se ejecutará cada vez que metadata cambie

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
      />

      <SongData metadata={metadata} handleSongClick={handleSongClick} />

      <AudioPlayer currentFile={currentFile} />
      <Controls handlePreviousClick={handlePreviousClick} handleNextClick={handleNextClick} />

      {/* <Lista items={filePaths} save={handleSaveClick} /> */}
    </div>
  )
}

export default FilePathsComponent
function PlaylistActions({ selectFiles, handleSaveClick, openM3U, detectM3U }) {
  return (
    <div>
      <button onClick={selectFiles}>{'Select Files'}</button>
      <button onClick={handleSaveClick}>Save</button>
      <button onClick={openM3U}>cargar lista</button>
      <button onClick={detectM3U}>Detectar lista</button>
    </div>
  )
}

function Controls({ handlePreviousClick, handleNextClick }) {
  return (
    <div>
      <button onClick={handlePreviousClick}>Previous</button>
      <button onClick={handleNextClick}>Next</button>
    </div>
  )
}

function SongData({ metadata, handleSongClick }) {
  return (
    <div>
      {metadata && metadata.length > 0 ? (
        <ul>
          {metadata.map((file, index) => (
            <div className="div" key={index}>
              <li
                style={{ fontSize: '11px', cursor: 'pointer', border: '1px solid white' }}
                onClick={() => handleSongClick(file, index)}
              >
                {file.fileName}
              </li>
            </div>
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}

function AudioPlayer({ currentFile }) {
  const BinToBlob = (img, mimeType = 'image/png') => {
    if (img && img.data && img.type !== 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      return url
    }
    return 'https://i.pinimg.com/564x/ca/2d/fe/ca2dfe6759c3e0183f83617364edbe2c.jpg'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src={BinToBlob(currentFile?.picture?.[0] || {})} style={{ width: '200px' }} alt="" />
        <p>{currentFile.title ? currentFile.title : currentFile.fileName}</p>
      </div>

      <audio controls key={currentFile.filePath} autoPlay>
        <source src={currentFile.filePath} type="audio/mpeg" />
        Tu navegador no soporta el elemento de audio.
      </audio>
    </div>
  )
}
