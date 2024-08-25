/* eslint-disable react/prop-types */
import { createContext, useContext } from 'react'

const AppContext = createContext()
export const AppProvider = ({ children }) => {
  return <AppContext.Provider value={{}}>{children}</AppContext.Provider>
}

// Hook personalizado para usar el contexto
export const useAppContext = () => {
  return useContext(AppContext)
}
