import { createContext, useContext, useEffect, useState } from 'react'
import { useSuper } from './SupeContext'
import { toast } from 'react-toastify'

const AudioContextState = createContext(null)

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const { currentFile, mediaRef, addhistory } = useSuper()
  const [path, setPath] = useState(null)

  useEffect(() => {
    if (currentFile) {
      const file = currentFile
      const sanitizedPath = sanitizePath(currentFile.filePath)
      setPath(sanitizedPath)
      const timer = setTimeout(() => {
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

      return () => clearTimeout(timer)
    }
  }, [currentFile])

  function sanitizePath(path) {
    if (!path) return null
    let newPath = path.replace(/\\/g, '/').replace(/#/g, '%23')
    if (/^([a-zA-Z]):/.test(newPath)) {
      newPath = `file:///${newPath}`
    }
    return newPath
  }

  return (
    <AudioContextState.Provider value={{}}>
      {children}
      <audio
        ref={mediaRef}
        controls
        autoPlay
        style={{ display: 'none' }}
        src={path}
      />
    </AudioContextState.Provider>
  )
}
