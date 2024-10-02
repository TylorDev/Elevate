import { createContext, useContext, useEffect } from 'react'
import { useSuper } from './SupeContext'

const AudioContextState = createContext(null)

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const { currentFile, handleNextClick, mediaRef, fetchLastData } = useSuper()

  useEffect(() => {
    const initializeApp = async () => {
      await fetchLastData()
    }

    initializeApp()
  }, [])
  return (
    <AudioContextState.Provider value={{}}>
      {children}
      <audio ref={mediaRef} controls autoPlay onEnded={handleNextClick} style={{ display: 'none' }}>
        {currentFile && currentFile.filePath ? (
          <source src={currentFile.filePath} type="audio/mpeg" />
        ) : (
          <p>Tu navegador no soporta el elemento de audio.</p>
        )}
      </audio>
    </AudioContextState.Provider>
  )
}
