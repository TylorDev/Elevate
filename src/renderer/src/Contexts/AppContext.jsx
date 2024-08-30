import { createContext, useContext } from 'react'

const AppContext = createContext()
export const AppProvider = ({ children }) => {
  const api = 2
  return <AppContext.Provider value={{}}>{children}</AppContext.Provider>
}

// Hook personalizado para usar el contexto
export const useAppContext = () => {
  return useContext(AppContext)
}
