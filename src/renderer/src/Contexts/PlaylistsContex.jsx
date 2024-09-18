/* eslint-disable react/prop-types */
import { createContext, useState, useContext, useEffect } from 'react'
import { dataToImageUrl, ElectronDelete, ElectronGetter, ElectronSetter2 } from './utils'
import { Bounce, toast } from 'react-toastify'

import { useSuper } from './SupeContext'

const ContextLikes = createContext()

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const { currentFile } = useSuper()
  const [metadata, setMetadata] = useState(null) // 1 ref - 5 ref
  const [randomPlaylist, setRandomPlaylist] = useState()
  const [playlists, setPlaylists] = useState([])
  const [arrayCovers, setArrayCovers] = useState([])
  const [currentCover, setCurrentCover] = useState('')
  const [arrayAlbums, setArrayAlbums] = useState([])
  // Función para obtener un file del estado según su filePath
  const getFileByFilePath = (filePath) => {
    const song = arrayCovers.find((file) => file.filePath === filePath)
    return song
  }

  const getAlbumByFilePath = (path) => {
    if (!path) {
      return 'El parámetro path es requerido.'
    }

    const list = arrayAlbums.find((file) => file && file.path === path)

    if (!list) {
      return 'No se encontraron coincidencias.'
    }

    return list
  }

  useEffect(() => {
    const cover = getFileByFilePath(currentFile.filePath)

    // Usa encadenamiento opcional y operador de fusión nula para manejar casos nulos o indefinidos
    setCurrentCover(cover?.cover ?? 'defaultCover')

    // console.log(currentFile.filePath)
  }, [currentFile])

  const updateArrayCovers = (someArray) => {
    if (someArray == null) {
      return null
    }
    // Crear un Set para filePaths existentes
    const existingFilePaths = new Set(arrayCovers.map((item) => item.filePath))

    // Filtrar someArray para encontrar los nuevos elementos
    const newItems = someArray.filter((item) => {
      if (existingFilePaths.has(item.filePath)) {
        return false
      } else {
        // console.log(`Nuevo filePath encontrado: ${item.filePath}.`)
        return true
      }
    })

    // Crear un array de nuevos objetos con id generado (puedes ajustar esto según sea necesario)
    const newArrayCover = arrayCovers.concat(
      newItems.map((item, index) => ({
        id: arrayCovers.length + index, // Generar un nuevo id basado en el tamaño actual del arrayCover
        filePath: item.filePath,
        cover: item.picture && item.picture.length > 0 ? dataToImageUrl(item.picture[0]) : null
      }))
    )

    // Actualizar el estado con el nuevo arrayCover
    setArrayCovers(newArrayCover)
    // console.log('arrayCover actualizado:', newArrayCover)
  }

  const updateArrayAlbums = (someArray) => {
    if (someArray == null) {
      return null
    }
    // Crear un Set para filePaths existentes
    const existingFilePaths = new Set(arrayAlbums.map((item) => item.path))

    // Filtrar someArray para encontrar los nuevos elementos
    const newItems = someArray.filter((item) => {
      if (existingFilePaths.has(item.path)) {
        return false
      } else {
        console.log(`Nuevo filePath encontrado: ${item.path}.`)
        return true
      }
    })

    // Crear un array de nuevos objetos con id generado (puedes ajustar esto según sea necesario)
    const newArrayCover = arrayAlbums.concat(
      newItems.map((item, index) => ({
        id: arrayAlbums.length + index, // Generar un nuevo id basado en el tamaño actual del arrayCover
        path: item.path,
        cover: dataToImageUrl(item.cover)
      }))
    )

    // Actualizar el estado con el nuevo arrayCover
    setArrayAlbums(newArrayCover)
    console.log('arrayAlbums actualizado:', newArrayCover)
  }

  const openM3U = async () => {
    await ElectronGetter('load-list', setMetadata, null, 'se cargo correctamente la lista nueva') // 0 ref
    getSavedLists()
  }

  const getSavedLists = () =>
    ElectronGetter('get-playlists', setPlaylists, null, 'todas las listas cargadas!')
  const getRandomList = () =>
    ElectronGetter('get-random-playlist', setRandomPlaylist, null, 'random list cargada')
  const addPlaylisthistory = (path) => ElectronSetter2('load-list-to-history', path)
  const updatePlaylist = async (path, data) => {
    const response = await ElectronSetter2('change-list-name', path, data)

    if (response.success) {
      console.log(response.message)
      getSavedLists()
    } else {
      console.error(response.message)
      toast.error(response.message, {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })
    }

    return response // Retornar la respuesta para un manejo posterior si es necesario
  }

  const deletePlaylist = async (filePath) => {
    await ElectronDelete('delete-playlist', filePath, 'lista eliminada!')
    setPlaylists((prevPlaylists) => prevPlaylists.filter((playlist) => playlist.path !== filePath))
  }
  const getUniqueList = async (setState, filePath) => {
    await ElectronGetter('get-list', setState, filePath, 'se obtuvo los datos de la lista!')
  }

  useEffect(() => {
    getRandomList()
    getAllSongs()
  }, [])

  const getAllSongs = async () => {
    await ElectronGetter(
      'get-all-audio-files',
      setMetadata,
      null,
      'Se obtuvieron todas las canciones!'
    )
  }

  const [news, setNews] = useState([])
  const getNews = async () =>
    await ElectronGetter('get-new-audio-files', setNews, null, 'Recientes obtenidos!')

  useEffect(() => {
    const handleNotification = async (message) => {
      console.log(message) // Maneja el mensaje como desees
      toast.success(message || 'Completado!', {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })

      await getNews()
      await getAllSongs()
    }

    window.electron.ipcRenderer.on('notification', handleNotification)

    // Cleanup listener on component unmount
    return () => {
      window.electron.ipcRenderer.off('notification', handleNotification)
    }
  }, [])

  return (
    <ContextLikes.Provider
      value={{
        metadata,
        playlists,
        getSavedLists,
        addPlaylisthistory,
        deletePlaylist,
        getUniqueList,
        getAllSongs,
        openM3U,
        getAlbumByFilePath,
        randomPlaylist,
        updatePlaylist,
        news,
        getNews,
        updateArrayCovers,
        getFileByFilePath,
        currentCover,
        updateArrayAlbums
      }}
    >
      {children}
    </ContextLikes.Provider>
  )
}
