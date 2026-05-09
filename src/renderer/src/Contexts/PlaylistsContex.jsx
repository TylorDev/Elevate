 
import { createContext, useState, useContext, useEffect, useRef } from 'react'
import {
  createLatestOnlyInvoker,
  dataToImageUrl,
  dedupedInvoke,
  ElectronDelete,
  ElectronGetter,
  ElectronSetter2
} from './utils'
import { Bounce, toast } from 'react-toastify'
import { useCoverUrl } from '../hooks/useCoverUrl'

import { useSuper } from './SupeContext'
import { useMini } from './MiniContext'

const ContextLikes = createContext()

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const { currentFile, getImage } = useSuper()
  const currentCover = useCoverUrl(currentFile?.filePath, 'full')
  const [allSongs, SetAllSongs] = useState([]) // 1 ref - 5 ref
  const [allSongsLoading, setAllSongsLoading] = useState(false)
  const [allSongsHasMore, setAllSongsHasMore] = useState(true)
  const [allSongsPage, setAllSongsPage] = useState(0)
  const [allSongsTotal, setAllSongsTotal] = useState(0)
  const [randomPlaylist, setRandomPlaylist] = useState()
  const [playlists, setPlaylists] = useState([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false)
  const [playlistsLastLoadedAt, setPlaylistsLastLoadedAt] = useState(null)
  const playlistsRequestRef = useRef(null)
  const playlistsInvokerRef = useRef(createLatestOnlyInvoker())
  const allSongsRequestRef = useRef(null)
  const allSongsLoadedPagesRef = useRef(new Set())
  const [arrayCovers, setArrayCovers] = useState([])
  const [arrayAlbums, setArrayAlbums] = useState([])

  const { removeTrack, addSong } = useSuper()

  const { getDirectories, deleteDirectory } = useMini()
  const removeSongFromList = async (playlistPath, index) => {
    await removeTrack(playlistPath, index)

    getSavedLists({ force: true })
  }

  const addSongToList = async (playlistPath, newTrack) => {
    await addSong(playlistPath, newTrack)
    getSavedLists({ force: true })
  }

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

  useEffect(() => {
    updateArrayAlbums(playlists)
  }, [playlists])

  const openM3U = async () => {
    await ElectronGetter('load-list', SetAllSongs, null, 'se cargo correctamente la lista nueva') // 0 ref
    getSavedLists({ force: true })
  }

  const getSavedLists = async ({ force = false } = {}) => {
    if (!force && playlistsLoaded) {
      return playlists
    }

    if (playlistsRequestRef.current && !force) {
      return playlistsRequestRef.current
    }

    setPlaylistsLoading(true)

    const request = playlistsInvokerRef.current('get-playlists', force ? Date.now() : null)
      .then(({ isLatest, result }) => {
        if (isLatest && result) {
          setPlaylists(result)
          setPlaylistsLoaded(true)
          setPlaylistsLastLoadedAt(Date.now())
        }

        return result
      })
      .catch((error) => {
        console.error('Error loading playlists:', error)
        throw error
      })
      .finally(() => {
        if (playlistsRequestRef.current === request) {
          playlistsRequestRef.current = null
          setPlaylistsLoading(false)
        }
      })

    playlistsRequestRef.current = request
    return request
  }
  const getRandomList = () =>
    ElectronGetter('get-random-playlist', setRandomPlaylist, null, 'random list cargada')
  const addPlaylisthistory = (path) => ElectronSetter2('load-list-to-history', path)
  const updatePlaylist = async (path, data) => {
    const response = await ElectronSetter2('change-list-name', path, data)

    if (response.success) {
      console.log(response.message)
      getSavedLists({ force: true })
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
    setPlaylistsLoaded(false)
  }
  const getUniqueList = async (setState, filePath) => {
    await ElectronGetter('get-list', setState, filePath, 'se obtuvo los datos de la lista!')
  }

  const deleteDirectoryList = async (path) => {
    await deleteDirectory(path)

    SetAllSongs([])
    allSongsLoadedPagesRef.current.clear()
    getAllSongs(1, { reset: true })
  }
  const getAllSongs = async (page = 1, { pageSize = 100, reset = false } = {}) => {
    const nextPage = Math.max(Number(page) || 1, 1)

    if (allSongsRequestRef.current) {
      return allSongsRequestRef.current
    }

    if (!reset && allSongsLoadedPagesRef.current.has(nextPage)) {
      return null
    }

    setAllSongsLoading(true)

    if (reset) {
      SetAllSongs([])
      setAllSongsHasMore(true)
      setAllSongsPage(0)
      setAllSongsTotal(0)
      allSongsLoadedPagesRef.current.clear()
    }

    const request = dedupedInvoke('get-all-audio-files-page', {
      page: nextPage,
      pageSize
    })
      .then((result) => {
        const newSongs = result?.items || []

        SetAllSongs((prevSongs) => {
          if (reset) {
            // Deduplicate newSongs internally even on reset
            const seen = new Set()
            return newSongs.filter((song) => {
              if (seen.has(song.filePath)) return false
              seen.add(song.filePath)
              return true
            })
          }

          if (!Array.isArray(prevSongs)) {
            return newSongs
          }

          const existingFilePaths = new Set(prevSongs.map((song) => song.filePath))
          const uniqueNewSongs = []

          for (const song of newSongs) {
            if (!existingFilePaths.has(song.filePath)) {
              uniqueNewSongs.push(song)
              existingFilePaths.add(song.filePath) // Add it so we don't pick it twice if it's twice in newSongs
            }
          }

          return [...prevSongs, ...uniqueNewSongs]
        })

        allSongsLoadedPagesRef.current.add(nextPage)
        setAllSongsHasMore(Boolean(result?.hasMore))
        setAllSongsPage(result?.page || nextPage)
        setAllSongsTotal(result?.total || newSongs.length)

        return result
      })
      .catch((error) => {
        console.error('Error loading all songs:', error)
        throw error
      })
      .finally(() => {
        if (allSongsRequestRef.current === request) {
          allSongsRequestRef.current = null
          setAllSongsLoading(false)
        }
      })

    allSongsRequestRef.current = request
    return request
  }

  const [news, setNews] = useState([])
  const getNews = async () =>
    await ElectronGetter('get-new-audio-files', setNews, null, 'Recientes obtenidos!')

  useEffect(() => {
    const handleNotification = async (message) => {
      if (message == '[new]' || message === '[directory-changed]') {
        getAllSongs(1, { reset: true })
        getDirectories({ force: true })
        if (message === '[directory-changed]') return // No toast for watcher events
      }

      // Skip scan-progress JSON messages from toast
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : null
        if (parsed?.type === 'scan-progress') return
      } catch {
        // Not JSON, continue to toast
      }

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
    }

    window.electron.ipcRenderer.on('notification', handleNotification)

    return () => {
      window.electron.ipcRenderer.off('notification', handleNotification)
    }
  }, [])

  return (
    <ContextLikes.Provider
      value={{
        allSongs,
        allSongsLoading,
        allSongsHasMore,
        allSongsPage,
        allSongsTotal,
        playlists,
        playlistsLoading,
        playlistsLoaded,
        playlistsLastLoadedAt,
        getSavedLists,
        addPlaylisthistory,
        deletePlaylist,
        getUniqueList,
        getAllSongs,
        openM3U,

        randomPlaylist,
        updatePlaylist,
        news,
        getNews,
        updateArrayCovers,

        currentCover,
        updateArrayAlbums,
        getRandomList,
        removeSongFromList,
        addSongToList,
        deleteDirectoryList
      }}
    >
      {children}
    </ContextLikes.Provider>
  )
}
