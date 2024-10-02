import { createContext, useContext, useState } from 'react'
import { ElectronDelete, ElectronGetter, ElectronGetter2, ElectronSetter } from './utils'
import { useSuper } from './SupeContext'

// Crear el contexto
const MiniContext = createContext()

// Proveedor del contexto
// eslint-disable-next-line react/prop-types
export const MiniProvider = ({ children }) => {
  const [recents, setRecents] = useState([])
  const getRecents = () => ElectronGetter('get-recents', setRecents, null, 'Recientes obtenidos!')

  const [most, setMost] = useState([])
  const getMost = () => ElectronGetter('get-most-played', setMost, null, 'Mas eschados cargados!')

  const [results, setResults] = useState([])
  const searchSongs = async (value) => await ElectronGetter2('search', setResults, value)

  const [directories, setDiretories] = useState([])
  const [history, setHistory] = useState([])
  const [later, setLater] = useState([])
  const [lista, setLista] = useState([])
  const { getImage } = useSuper()

  // Función para agregar un elemento al final de la lista
  function agregarElemento(elemento) {
    if (elemento === null || elemento === undefined) {
      console.error('Elemento no puede ser nulo o indefinido.')
      return
    }

    const existe = lista.some((item) => item.filePath === elemento.filePath)
    if (existe) {
      console.warn('Elemento ya existe en la lista.')
      return
    }

    setLista([...lista, elemento])
    console.log(lista)
  }

  // Función para eliminar un elemento por su índice
  function eliminarElemento(elemento) {
    if (elemento === null || elemento === undefined) {
      console.error('Elemento no puede ser nulo o indefinido.')
      return
    }

    const existe = lista.some((item) => item.filePath === elemento.filePath)
    if (!existe) {
      console.warn('Elemento no encontrado en la lista.')
      console.log(lista)
      return
    }

    setLista(lista.filter((item) => item.filePath !== elemento.filePath))
    console.log(lista)
  }

  const getDirectories = () =>
    ElectronGetter('get-all-directories', setDiretories, null, 'directorios obtenidos!')
  const deleteDirectory = async (path) => {
    await ElectronDelete('delete-directory', path, 'directorio eliminado!')
    setDiretories((preDir) => preDir.filter((dir) => dir.path !== path))
  }
  const addDirectory = async () => {
    await ElectronGetter('add-directory', null, null, 'Directorio agregado!') // 0 ref
    getDirectories()
  }
  const getDirFiles = (setState, value) => {
    ElectronGetter2('get-audio-in-directory', setState, value)
  }

  const getHistory = (page = 1) =>
    ElectronGetter('get-history', setHistory, page, 'se obtuvo el historial')

  const getlatersongs = async () => {
    await ElectronGetter(
      'get-listen-later',
      (laterData) => {
        setLater({
          ...laterData,
          cover: getImage('Later', laterData.cover)
        })
      },
      null,
      'listen later cargados!'
    )
  }

  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const latersong = (common) => ElectronSetter('listen-later-song', common)
  const getTotalTracks = (setState) => {
    ElectronGetter2('get-all-audio-files-number', setState)
  }
  const getTotalLikes = (setState) => {
    ElectronGetter2('get-likes-number', setState)
  }
  const getTotalLists = (setState) => {
    ElectronGetter2('get-playlists-number', setState)
  }
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
        addDirectory,
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
        eliminarElemento,
        getTotalTracks,
        getTotalLikes,
        getTotalLists
      }}
    >
      {children}
    </MiniContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useMini = () => {
  const context = useContext(MiniContext)
  if (!context) {
    throw new Error('useMini debe ser usado dentro de un MiniProvider')
  }
  return context
}
