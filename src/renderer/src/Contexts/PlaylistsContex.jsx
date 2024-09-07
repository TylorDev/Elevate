import { createContext, useState, useContext, useEffect } from 'react'
import { ElectronDelete, ElectronGetter, ElectronGetter2, ElectronSetter2 } from './utils'
import { Bounce, toast } from 'react-toastify'

const ContextLikes = createContext()

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const [metadata, setMetadata] = useState(null) // 1 ref - 5 ref
  const [randomPlaylist, setRandomPlaylist] = useState()
  const [playlists, setPlaylists] = useState([])

  const getAllSongs = () =>
    ElectronGetter('get-all-audio-files', setMetadata, null, 'Se obtuvieron todas las canciones!') //1 ref
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

  useEffect(() => {
    const handleNotification = (message) => {
      console.log(message) // Maneja el mensaje como desees

      getAllSongs()
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

        randomPlaylist,
        updatePlaylist
      }}
    >
      {children}
    </ContextLikes.Provider>
  )
}
