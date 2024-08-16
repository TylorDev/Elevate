import { createContext, useContext, useState } from 'react'
import { ElectronGetter, ElectronGetter2, ElectronSetter, ElectronSetter2 } from './utils'

// Crear el contexto
const MiniContext = createContext()

// Proveedor del contexto
// eslint-disable-next-line react/prop-types
export const MiniProvider = ({ children }) => {
  const [recents, setRecents] = useState([]) // 1 ref
  const [most, setMost] = useState([]) // 1 ref  check
  const [results, setResults] = useState([]) // 1 ref  check
  const [directories, setDiretories] = useState([]) // 1 ref  check
  const [m3ulists, setM3uLists] = useState([]) // 1 ref  check
  const [history, setHistory] = useState([]) // 1 ref  check
  const [later, setLater] = useState([]) // 1 ref check
  const [emptyList, setEmptyList] = useState([]) // 1 ref  check

  const getRecents = () => ElectronGetter('get-recents', setRecents)
  const getMost = () => ElectronGetter('get-most-played', setMost)
  const searchSongs = (value) => ElectronGetter2('search', setResults, value)
  const getDirectories = () => ElectronGetter('get-all-directories', setDiretories)
  const getSavedLists = () => ElectronGetter('get-playlists', setM3uLists)
  const deleteDirectory = (filePath) => {
    const setState = []
    getDirectories()
    ElectronGetter('delete-directory', setState, filePath)
  }
  const getHistory = () => ElectronGetter('get-history', setHistory)
  const getlatersongs = () => ElectronGetter('get-listen-later', setLater)
  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const latersong = (common) => ElectronSetter('listen-later-song', common)
  const addItemToEmptyList = (item) => {
    setEmptyList([...emptyList, item])
  }

  const getUniqueList = (setState, filePath) => {
    ElectronGetter('open-list', setState, filePath)
  } // 0 ref
  const deletePlaylist = (filePath) => {
    const setState = []
    ElectronGetter('delete-playlist', setState, filePath)
  } // 0 ref
  const addPlaylisthistory = (path) => ElectronSetter2('add-list-to-history', path) // 0 ref

  return (
    <MiniContext.Provider
      value={{
        recents,
        getRecents,
        most,
        getMost,
        results,
        searchSongs,
        directories,
        getDirectories,
        deleteDirectory,
        m3ulists,
        getSavedLists,
        history,
        getHistory,
        later,
        getlatersongs,
        removelatersong,
        latersong,
        emptyList,
        addItemToEmptyList,
        addPlaylisthistory,
        deletePlaylist,
        getUniqueList
      }}
    >
      {children}
    </MiniContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useMini = () => useContext(MiniContext)
