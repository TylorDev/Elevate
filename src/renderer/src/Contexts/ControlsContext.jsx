import { createContext, useContext, useRef, useState, useEffect } from 'react'

// Crear el contexto
const ControlsContext = createContext()

// Proveedor del contexto
export const ControlsProvider = ({ children }) => {
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)

  // Función para alternar el estado de silencio
  const toggleMuteAudio = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted((prev) => !prev)
    }
  }

  return (
    <ControlsContext.Provider value={{ audioRef, toggleMuteAudio, isMuted }}>
      {children}
    </ControlsContext.Provider>
  )
}

// Hook personalizado para usar el contexto
export const useAudio = () => useContext(ControlsContext)
