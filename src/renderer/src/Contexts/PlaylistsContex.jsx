import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Bounce, toast } from 'react-toastify'
import { useCoverUrl } from '../hooks/useCoverUrl'
import { useMini } from './MiniContext'
import { useSuper } from './SupeContext'
import {
  createLatestOnlyInvoker,
  dataToImageUrl,
  dedupedInvoke,
  ElectronDelete,
  ElectronGetter,
  ElectronSetter2
} from './utils'

const ContextLikes = createContext()

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const { currentFile } = useSuper()
  const currentCover = useCoverUrl(currentFile?.filePath, 'full')
  const { getDirectories, deleteDirectory } = useMini()
  const { removeTrack, addSong } = useSuper()

  const [allSongs, SetAllSongs] = useState([])
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
  const [, setArrayCovers] = useState([])
  const [, setArrayAlbums] = useState([])
  const [news, setNews] = useState([])

  const updateArrayCovers = useCallback((someArray) => {
    if (someArray == null) {
      return null
    }

    setArrayCovers((currentCovers) => {
      const existingFilePaths = new Set(currentCovers.map((item) => item.filePath))
      const newItems = someArray.filter((item) => !existingFilePaths.has(item.filePath))

      if (newItems.length === 0) {
        return currentCovers
      }

      return currentCovers.concat(
        newItems.map((item, index) => ({
          id: currentCovers.length + index,
          filePath: item.filePath,
          cover: item.picture && item.picture.length > 0 ? dataToImageUrl(item.picture[0]) : null
        }))
      )
    })
  }, [])

  const updateArrayAlbums = useCallback((someArray) => {
    if (someArray == null) {
      return null
    }

    setArrayAlbums((currentAlbums) => {
      const existingFilePaths = new Set(currentAlbums.map((item) => item.path))
      const newItems = someArray.filter((item) => !existingFilePaths.has(item.path))

      if (newItems.length === 0) {
        return currentAlbums
      }

      return currentAlbums.concat(
        newItems.map((item, index) => ({
          id: currentAlbums.length + index,
          path: item.path,
          cover: dataToImageUrl(item.cover)
        }))
      )
    })
  }, [])

  useEffect(() => {
    updateArrayAlbums(playlists)
  }, [playlists, updateArrayAlbums])

  const getSavedLists = useCallback(async ({ force = false } = {}) => {
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
  }, [playlists, playlistsLoaded])

  const getAllSongs = useCallback(async (page = 1, { pageSize = 100, reset = false } = {}) => {
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
              existingFilePaths.add(song.filePath)
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
  }, [])

  const openM3U = useCallback(async () => {
    await ElectronGetter('load-list', SetAllSongs, null, 'se cargo correctamente la lista nueva')
    await getSavedLists({ force: true })
  }, [getSavedLists])

  const getRandomList = useCallback(
    () => ElectronGetter('get-random-playlist', setRandomPlaylist, null, 'random list cargada'),
    []
  )

  const addPlaylisthistory = useCallback((path) => ElectronSetter2('load-list-to-history', path), [])

  const updatePlaylist = useCallback(async (path, data) => {
    const response = await ElectronSetter2('change-list-name', path, data)

    if (response.success) {
      console.log(response.message)
      await getSavedLists({ force: true })
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

    return response
  }, [getSavedLists])

  const updatePlaylistMetadata = useCallback(async (path, payload) => {
    const response = await dedupedInvoke('update-playlist-metadata', {
      path,
      ...payload
    })

    if (response.success) {
      console.log('Playlist metadata updated:', response.playlist)
      if (response.playlist) {
        setPlaylists((previousPlaylists) =>
          previousPlaylists.map((playlist) =>
            playlist.path === path
              ? {
                  ...playlist,
                  ...response.playlist,
                  // When effectiveCover is null (name-only change), preserve existing cover
                  cover: response.effectiveCover ?? playlist.cover,
                  effectiveCover: response.effectiveCover ?? playlist.effectiveCover,
                  coverConfig: response.coverConfig ?? playlist.coverConfig
                }
              : playlist
          )
        )
        setPlaylistsLoaded(true)
        setPlaylistsLastLoadedAt(Date.now())
      }
    } else {
      console.error('Error updating playlist metadata:', response.error)
      toast.error(response.error || 'Error al actualizar la playlist', {
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

    return response
  }, [])

  const deletePlaylist = useCallback(async (filePath) => {
    await ElectronDelete('delete-playlist', filePath, 'lista eliminada!')
    setPlaylists((prevPlaylists) => prevPlaylists.filter((playlist) => playlist.path !== filePath))
    setPlaylistsLoaded(false)
  }, [])

  const getUniqueList = useCallback(async (setState, filePath) => {
    await ElectronGetter('get-list', setState, filePath, 'se obtuvo los datos de la lista!')
  }, [])

  const removeSongFromList = useCallback(async (playlistPath, index) => {
    await removeTrack(playlistPath, index)
    await getSavedLists({ force: true })
  }, [getSavedLists, removeTrack])

  const addSongToList = useCallback(async (playlistPath, newTrack) => {
    await addSong(playlistPath, newTrack)
    await getSavedLists({ force: true })
  }, [addSong, getSavedLists])

  const appendTracksToPlaylist = useCallback(async (playlistPath, tracks = []) => {
    const filePaths = tracks
      .map((track) => track?.filePath)
      .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')

    const result = await dedupedInvoke('append-tracks-to-playlist', {
      playlistPath,
      filePaths
    })

    if (result?.success) {
      await getSavedLists({ force: true })
    }

    return result
  }, [getSavedLists])

  const resolvePlaylistSaveDirectory = useCallback(async (sourcePath = '') => {
    const result = await dedupedInvoke('get-playlist-save-directory', sourcePath)
    return result?.path || null
  }, [])

  const listPlaylistSaveDirectory = useCallback(async (directoryPath) => {
    return dedupedInvoke('list-playlist-save-directory', directoryPath)
  }, [])

  const savePlaylistFromTracks = useCallback(
    async (tracks = [], { nombre = '', targetDirectory = '', replacePath = null } = {}) => {
      const filePaths = tracks
        .map((track) => track?.filePath)
        .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')

      if (filePaths.length === 0) {
        toast.error('No hay canciones para guardar.', {
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
        return { success: false, error: 'No tracks to save' }
      }

      let result

      try {
        result = await dedupedInvoke('save-m3u', {
          filePaths,
          targetDirectory,
          targetPath: replacePath,
          nombre
        })
      } catch (error) {
        toast.error(error?.message || 'No se pudo guardar la playlist.', {
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

        return { success: false, error: error?.message || 'Error saving playlist' }
      }

      if (!result?.success) {
        toast.error(result?.error || 'No se pudo guardar la playlist.', {
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
        return result
      }

      await getSavedLists({ force: true })

      toast.success(`Playlist guardada: ${result.playlistName}`, {
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

      return result
    },
    [getSavedLists]
  )

  const exportPlaylistTracks = useCallback(async (tracks = [], { suggestedName = '' } = {}) => {
    const filePaths = tracks
      .map((track) => track?.filePath)
      .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')

    if (filePaths.length === 0) {
      toast.error('No hay canciones para exportar.', {
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
      return { success: false, error: 'No tracks to export' }
    }

    let result

    try {
      result = await dedupedInvoke('save-m3u', {
        filePaths,
        nombre: suggestedName
      })
    } catch (error) {
      toast.error(error?.message || 'No se pudo exportar la playlist.', {
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
      return { success: false, error: error?.message || 'Error exporting playlist' }
    }

    if (!result?.success) {
      if (result?.error !== 'Save canceled') {
        toast.error(result?.error || 'No se pudo exportar la playlist.', {
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

      return result
    }

    toast.success(`Playlist exportada: ${result.playlistName}`, {
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

    return result
  }, [])

  const deleteDirectoryList = useCallback(async (path) => {
    await deleteDirectory(path)
    SetAllSongs([])
    allSongsLoadedPagesRef.current.clear()
    await getAllSongs(1, { reset: true })
  }, [deleteDirectory, getAllSongs])

  const getNews = useCallback(
    async () => ElectronGetter('get-new-audio-files', setNews, null, 'Recientes obtenidos!'),
    []
  )

  useEffect(() => {
    const handleNotification = async (message) => {
      if (message === '[new]' || message === '[directory-changed]') {
        getAllSongs(1, { reset: true })
        getDirectories({ force: true })
        if (message === '[directory-changed]') return
      }

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
  }, [getAllSongs, getDirectories])

  const contextValue = useMemo(
    () => ({
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
      updatePlaylistMetadata,
      news,
      getNews,
      updateArrayCovers,
      currentCover,
      updateArrayAlbums,
      getRandomList,
      removeSongFromList,
      addSongToList,
      appendTracksToPlaylist,
      deleteDirectoryList,
      exportPlaylistTracks,
      resolvePlaylistSaveDirectory,
      listPlaylistSaveDirectory,
      savePlaylistFromTracks
    }),
    [
      addPlaylisthistory,
      addSongToList,
      appendTracksToPlaylist,
      allSongs,
      allSongsHasMore,
      allSongsLoading,
      allSongsPage,
      allSongsTotal,
      currentCover,
      deleteDirectoryList,
      deletePlaylist,
      getAllSongs,
      getNews,
      getRandomList,
      getSavedLists,
      getUniqueList,
      news,
      openM3U,
      playlists,
      playlistsLastLoadedAt,
      playlistsLoaded,
      playlistsLoading,
      randomPlaylist,
      removeSongFromList,
      exportPlaylistTracks,
      resolvePlaylistSaveDirectory,
      listPlaylistSaveDirectory,
      savePlaylistFromTracks,
      updateArrayAlbums,
      updateArrayCovers,
      updatePlaylist,
      updatePlaylistMetadata
    ]
  )

  return <ContextLikes.Provider value={contextValue}>{children}</ContextLikes.Provider>
}
