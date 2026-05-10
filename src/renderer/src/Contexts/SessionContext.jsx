import { createContext, useContext, useState, useEffect } from 'react'

const SessionContext = createContext()
const EMPTY_QUEUE_STATE = {
  currentQueue: [],
  originalQueue: [],
  queueName: ''
}

function readStorageValue(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error)
    return fallback
  }
}

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

export const SessionProvider = ({ children }) => {
  const [queueState, setQueueState] = useState(() => readStorageValue('queueState', EMPTY_QUEUE_STATE))

  const [currentFile, setCurrentFile] = useState(() => readStorageValue('currentFile', ''))

  const [currentIndex, setCurrentIndex] = useState(() => readStorageValue('currentIndex', 0))

  const [isShuffled, setIsShuffled] = useState(() => readStorageValue('isShuffled', false))
  const [manualQueueOrders, setManualQueueOrders] = useState(() =>
    readStorageValue('manualQueueOrders', {})
  )

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

  useEffect(() => {
    localStorage.setItem('manualQueueOrders', JSON.stringify(manualQueueOrders))
  }, [manualQueueOrders])

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
        setIsShuffled,
        manualQueueOrders,
        setManualQueueOrders
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
