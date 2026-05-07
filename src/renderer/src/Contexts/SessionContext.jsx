import { createContext, useContext, useState, useEffect } from 'react'

const SessionContext = createContext()

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

export const SessionProvider = ({ children }) => {
  const [queueState, setQueueState] = useState(() => {
    try {
      const saved = localStorage.getItem('queueState')
      return saved
        ? JSON.parse(saved)
        : {
            currentQueue: [],
            originalQueue: [],
            queueName: ''
          }
    } catch (e) {
      console.error('Error loading queueState from localStorage', e)
      return {
        currentQueue: [],
        originalQueue: [],
        queueName: ''
      }
    }
  })

  const [currentFile, setCurrentFile] = useState(() => {
    try {
      const saved = localStorage.getItem('currentFile')
      return saved ? JSON.parse(saved) : ''
    } catch (e) {
      console.error('Error loading currentFile from localStorage', e)
      return ''
    }
  })

  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('currentIndex')
      return saved ? JSON.parse(saved) : 0
    } catch (e) {
      console.error('Error loading currentIndex from localStorage', e)
      return 0
    }
  })

  const [isShuffled, setIsShuffled] = useState(() => {
    try {
      const saved = localStorage.getItem('isShuffled')
      return saved ? JSON.parse(saved) : false
    } catch (e) {
      console.error('Error loading isShuffled from localStorage', e)
      return false
    }
  })

  useEffect(() => {
    localStorage.setItem('queueState', JSON.stringify(queueState))
  }, [queueState])

  useEffect(() => {
    localStorage.setItem('isShuffled', JSON.stringify(isShuffled))
  }, [isShuffled])

  useEffect(() => {
    localStorage.setItem('currentFile', JSON.stringify(currentFile))
  }, [currentFile])

  useEffect(() => {
    localStorage.setItem('currentIndex', JSON.stringify(currentIndex))
  }, [currentIndex])

  return (
    <SessionContext.Provider
      value={{
        queueState,
        setQueueState,
        currentFile,
        setCurrentFile,
        currentIndex,
        setCurrentIndex,
        isShuffled,
        setIsShuffled
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
