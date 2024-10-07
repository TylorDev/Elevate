import { createContext, useContext, useEffect, useState } from 'react'
import { useSuper } from './SupeContext'
import { toast } from 'react-toastify'

const AudioContextState = createContext(null)

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const { currentFile, handleNextClick, mediaRef, fetchLastData, addhistory } = useSuper()
  const [path, setPath] = useState('')
  useEffect(() => {
    const initializeApp = async () => {
      await fetchLastData()
    }

    initializeApp()
  }, [])

  useEffect(() => {
    if (currentFile) {
      const file = currentFile
      const sanitizedPath = sanitizePath(currentFile.filePath)
      setPath(sanitizedPath)
      const timer = setTimeout(() => {
        // Verifica si el valor sigue siendo el mismo después de 5 segundos
        if (currentFile === file) {
          toast.warning(`se agrego ${currentFile.fileName} a historial`, {
            position: 'bottom-right',
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: 'dark'
          })
          addhistory(currentFile)
        }
      }, 10000)

      // Limpia el temporizador si currentFile cambia antes de los 5 segundos
      return () => clearTimeout(timer)
    }
  }, [currentFile])

  function sanitizePath(path) {
    const Newpath = path.replace(/#/g, '%23')

    return Newpath
  }

  return (
    <AudioContextState.Provider value={{}}>
      {children}
      <audio ref={mediaRef} controls autoPlay onEnded={handleNextClick} style={{ display: 'none' }}>
        {currentFile && currentFile.filePath ? (
          <source src={path} type="audio/mpeg" />
        ) : (
          <p>Tu navegador no soporta el elemento de audio.</p>
        )}
      </audio>
    </AudioContextState.Provider>
  )
}
