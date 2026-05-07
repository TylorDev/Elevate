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

  useEffect(() => {
    localStorage.setItem('queueState', JSON.stringify(queueState))
  }, [queueState])

  return (
    <SessionContext.Provider value={{ queueState, setQueueState }}>
      {children}
    </SessionContext.Provider>
  )
}
