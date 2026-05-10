import { createContext, useContext, useEffect, useState } from 'react'
import { useSuper } from './SupeContext'
import { toast } from 'react-toastify'
import { useArgv } from './ArgvContext'

const AudioContextState = createContext(null)

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const { currentFile, mediaRef, addhistory, volume, muted, loop } = useSuper()
  const { autoplayRequestId } = useArgv()
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

  useEffect(() => {
    if (!path || !mediaRef.current) {
      return
    }

    const audio = mediaRef.current
    audio.volume = Math.max(0, Math.min(1, Number(volume) || 0))
    audio.muted = Boolean(muted)
    audio.loop = Boolean(loop)
  }, [loop, mediaRef, muted, path, volume])

  useEffect(() => {
    if (!autoplayRequestId || !path || !mediaRef.current) {
      return
    }

    const audio = mediaRef.current
    const tryPlay = () => {
      audio.play().catch((error) => {
        console.warn('Auto-play skipped while syncing resumed session:', error?.message || error)
      })
    }

    if (audio.readyState >= 2) {
      tryPlay()
      return
    }

    audio.addEventListener('canplay', tryPlay, { once: true })
    return () => {
      audio.removeEventListener('canplay', tryPlay)
    }
  }, [autoplayRequestId, path, mediaRef])

  return (
    <AudioContextState.Provider value={{}}>
      {children}
      <audio
        ref={mediaRef}
        controls
        style={{ display: 'none' }}
        src={path}
        autoPlay
      />
    </AudioContextState.Provider>
  )
}
