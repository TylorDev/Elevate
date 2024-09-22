import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSuper } from './SupeContext'

const AudioContextState = createContext(null)

export const useAudioContext = () => {
  return useContext(AudioContextState)
}

export const AudioProvider = ({ children }) => {
  const [audioNode, setAudioNode] = useState(null)
  const { currentFile, handleNextClick, mediaRef } = useSuper()

  const [audioContext, setAudioContext] = useState(null)

  useEffect(() => {
    if (!audioContext) {
      const newAudioContext = new (window.AudioContext || window.webkitAudioContext)()
      setAudioContext(newAudioContext)
    }
  }, [])

  useEffect(() => {
    if (audioContext && mediaRef.current) {
      const audioN = audioContext.createMediaElementSource(mediaRef.current)
      setAudioNode(audioN)
      audioN.connect(audioContext.destination)
    }
  }, [audioContext])

  return (
    <AudioContextState.Provider value={{ audioContext, audioNode }}>
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
