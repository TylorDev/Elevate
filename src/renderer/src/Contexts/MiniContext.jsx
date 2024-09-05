import { createContext, useContext, useState } from 'react'
import { ElectronGetter, ElectronGetter2, ElectronSetter } from './utils'

// Crear el contexto
const MiniContext = createContext()

// Proveedor del contexto
// eslint-disable-next-line react/prop-types
export const MiniProvider = ({ children }) => {
  const [recents, setRecents] = useState([])
  const [most, setMost] = useState([])
  const [results, setResults] = useState([])
  const [directories, setDiretories] = useState([])
  const [history, setHistory] = useState([])
  const [later, setLater] = useState([])
  const [lista, setLista] = useState([])

  // Función para agregar un elemento al final de la lista
  function agregarElemento(elemento) {
    setLista([...lista, elemento])
  }

  // Función para eliminar un elemento por su índice
  function eliminarElemento(elemento) {
    setLista(lista.filter((item) => item !== elemento))
  }

  const getRecents = () => ElectronGetter('get-recents', setRecents)
  const getMost = () => ElectronGetter('get-most-played', setMost)
  const searchSongs = (value) => ElectronGetter2('search', setResults, value)
  const getDirectories = () => ElectronGetter('get-all-directories', setDiretories)
  const deleteDirectory = (filePath) => {
    const setState = []
    getDirectories()
    ElectronGetter('delete-directory', setState, filePath)
  }

  const getDirFiles = (setState, value) => {
    console.log(value)
    ElectronGetter2('get-audio-in-directory', setState, value)
  }

  const getHistory = () => ElectronGetter('get-history', setHistory)
  const getlatersongs = () => ElectronGetter('get-listen-later', setLater)
  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const latersong = (common) => ElectronSetter('listen-later-song', common)

  return (
    <MiniContext.Provider
      value={{
        recents, //     LISTA RECIENTES
        getRecents, //  OBTIENE LA  LISTA RECIENTES

        most, //      LISTA MAS POPULARES
        getMost, //      OBTIENE LA LISTA  MAS POPULARES

        results, // LISTA BARRA DE BUSQUEDA
        searchSongs, // BUSCA CANCIONES EN LA BD

        directories, // LISTA DIRECTORIOS
        getDirectories, //  OBTIENE LA  LISTA DIRECTORIOS
        deleteDirectory, // borra un directorio especifico
        getDirFiles,
        history, // LISTA DE HISTORIAL
        getHistory, //  OBTIENE LA  LISTA DE HISTORIAL

        later, //  LISTA MAS TARDE
        getlatersongs, //  OBTIENE LA LISTA MAS TARDE
        removelatersong, // QUITA UNA CANCION DE ESCUCHAR MAS TARDE
        latersong, // agrega una cancion a la LISTA MAS TARDE
        lista, // lista personalizada
        agregarElemento,
        eliminarElemento
      }}
    >
      {children}
    </MiniContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useMini = () => useContext(MiniContext)
