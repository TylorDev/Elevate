import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Bounce, toast } from 'react-toastify'
import { useSongCover } from './ImagesContext'
import { useI18n } from './I18nContext'
import { useMini } from './MiniContext'
import { useQueue } from './QueueContext'
import {
  createLatestOnlyInvoker,
  dedupedInvoke,
  ElectronGetter,
  ElectronSetter2
} from './utils'

const ContextLikes = createContext()
const PLAYLIST_DELETE_TOAST_ID = 'playlist-delete-status'

export const usePlaylists = () => useContext(ContextLikes)

export const PlaylistsProvider = ({ children }) => {
  const { t } = useI18n()
  const { currentFile, removeTrack, addSong } = useQueue()
  const currentCover = useSongCover(currentFile?.filePath, 'full')
  const { getDirectories, deleteDirectory } = useMini()

  const [allSongs, SetAllSongs] = useState([])
  const [allSongsLoading, setAllSongsLoading] = useState(false)
  const [allSongsHasMore, setAllSongsHasMore] = useState(true)
  const [allSongsPage, setAllSongsPage] = useState(0)
  const [randomPlaylist, setRandomPlaylist] = useState()
  const [playlists, setPlaylists] = useState([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false)
  const [playlistsLastLoadedAt, setPlaylistsLastLoadedAt] = useState(null)
  const playlistsRequestRef = useRef(null)
  const playlistsInvokerRef = useRef(createLatestOnlyInvoker())
  const pendingPlaylistDeletesRef = useRef(new Map())
  const pendingPlaylistDeleteJobsRef = useRef(new Map())
  const processedPlaylistDeleteJobsRef = useRef(new Set())
  const [deletingPlaylistPaths, setDeletingPlaylistPaths] = useState([])
  const allSongsRequestRef = useRef(null)
  const allSongsLoadedPagesRef = useRef(new Set())
  const [news, setNews] = useState([])

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

  const refreshPlaylistsInBackground = useCallback(() => {
    void getSavedLists({ force: true }).catch((error) => {
      console.error('Error refreshing playlists after import:', error)
    })
  }, [getSavedLists])

  const openM3U = useCallback(async (options = {}) => {
    const filePath = typeof options === 'string' ? options : options?.filePath
    let result

    try {
      result = filePath
        ? await dedupedInvoke('load-list', filePath)
        : await dedupedInvoke('load-list')
    } catch (error) {
      const errorMessage = error?.message || 'No se pudo importar la playlist.'
      toast.error(errorMessage, {
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
      return { success: false, error: errorMessage }
    }

    if (!result || result?.canceled) {
      return result
    }

    if (!result?.success) {
      toast.error(result?.error || t('playlists.saveFailed'), {
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

    refreshPlaylistsInBackground()

    toast.success(t('playlists.imported', { name: result.playlistName }), {
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
  }, [refreshPlaylistsInBackground, t])

  const getRandomList = useCallback(
    () => ElectronGetter('get-random-playlist', setRandomPlaylist, null, 'random list cargada'),
    []
  )

  const addPlaylisthistory = useCallback((path) => ElectronSetter2('load-list-to-history', path), [])

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
      toast.error(response.error || t('playlists.saveFailed'), {
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
  }, [t])

  const removeDeletingPlaylistPath = useCallback((filePath) => {
    setDeletingPlaylistPaths((previousPaths) => previousPaths.filter((path) => path !== filePath))
  }, [])

  const addDeletingPlaylistPath = useCallback((filePath) => {
    setDeletingPlaylistPaths((previousPaths) =>
      previousPaths.includes(filePath) ? previousPaths : [...previousPaths, filePath]
    )
  }, [])

  const isPlaylistDeleting = useCallback((filePath) => {
    return pendingPlaylistDeletesRef.current.has(filePath)
  }, [])

  const showPlaylistDeleteToast = useCallback((type, message) => {
    const toastOptions = {
      toastId: PLAYLIST_DELETE_TOAST_ID,
      position: 'bottom-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark',
      transition: Bounce
    }

    if (toast.isActive(PLAYLIST_DELETE_TOAST_ID)) {
      toast.update(PLAYLIST_DELETE_TOAST_ID, {
        ...toastOptions,
        render: message,
        type
      })
      return
    }

    const notify = type === 'error' ? toast.error : toast.success
    notify(message, toastOptions)
  }, [])

  const restoreOptimisticPlaylistDelete = useCallback((filePath) => {
    const deletedPlaylist = pendingPlaylistDeletesRef.current.get(filePath)
    pendingPlaylistDeletesRef.current.delete(filePath)
    removeDeletingPlaylistPath(filePath)

    if (deletedPlaylist) {
      setPlaylists((prevPlaylists) => {
        if (prevPlaylists.some((playlist) => playlist.path === filePath)) {
          return prevPlaylists
        }

        return [deletedPlaylist, ...prevPlaylists]
      })
    }

    setPlaylistsLoaded(false)
    void getSavedLists({ force: true })
  }, [getSavedLists, removeDeletingPlaylistPath])

  const deletePlaylist = useCallback((filePath) => {
    const normalizedPath = typeof filePath === 'string' ? filePath.trim() : ''

    if (!normalizedPath) {
      toast.error(t('playlists.invalidPath'), {
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
      return { success: false, error: t('playlists.invalidPath') }
    }

    if (pendingPlaylistDeletesRef.current.has(normalizedPath)) {
      return { success: true, queued: true, path: normalizedPath, duplicate: true }
    }

    const playlistSnapshot = playlists.find((playlist) => playlist.path === normalizedPath) || null

    setPlaylists((prevPlaylists) => {
      return prevPlaylists.filter((playlist) => playlist.path !== normalizedPath)
    })

    pendingPlaylistDeletesRef.current.set(normalizedPath, playlistSnapshot)

    addDeletingPlaylistPath(normalizedPath)

    void dedupedInvoke('delete-playlist', normalizedPath)
      .then((result) => {
        if (!result?.success) {
          restoreOptimisticPlaylistDelete(normalizedPath)
          showPlaylistDeleteToast('error', result?.error || t('playlists.saveFailed'))
        }

        if (result?.jobId) {
          pendingPlaylistDeleteJobsRef.current.set(result.jobId, normalizedPath)
        }
      })
      .catch((error) => {
        restoreOptimisticPlaylistDelete(normalizedPath)
        showPlaylistDeleteToast('error', error?.message || t('playlists.saveFailed'))
      })

    return { success: true, queued: true, path: normalizedPath }
  }, [addDeletingPlaylistPath, playlists, restoreOptimisticPlaylistDelete, showPlaylistDeleteToast, t])

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
      const uniqueFilePaths = Array.from(
        new Set(
          tracks
            .map((track) => track?.filePath)
            .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')
            .map((filePath) => filePath.trim())
        )
      )

      if (uniqueFilePaths.length === 0) {
        const emptyPlaylistMessage = t('playlists.playlistRequiredTracks')
        toast.error(emptyPlaylistMessage, {
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
        return { success: false, error: emptyPlaylistMessage }
      }

      let result

      try {
        result = await dedupedInvoke('save-m3u', {
          filePaths: uniqueFilePaths,
          targetDirectory,
          targetPath: replacePath,
          nombre
        })
      } catch (error) {
        const errorMessage = error?.message || t('playlists.saveFailed')
        toast.error(errorMessage, {
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

        return { success: false, error: errorMessage }
      }

      if (!result?.success) {
        toast.error(result?.error || t('playlists.saveFailed'), {
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

      toast.success(t('playlists.saved', { name: result.playlistName }), {
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
    [getSavedLists, t]
  )

  const exportPlaylistTracks = useCallback(async (tracks = [], { suggestedName = '' } = {}) => {
    const filePaths = tracks
      .map((track) => track?.filePath)
      .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')

    if (filePaths.length === 0) {
      toast.error(t('playlists.exportEmpty'), {
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
      toast.error(error?.message || t('playlists.saveFailed'), {
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
        toast.error(result?.error || t('playlists.saveFailed'), {
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

    toast.success(t('playlists.exported', { name: result.playlistName }), {
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
  }, [t])

  const exportPlaylistTracksToDirectory = useCallback(
    async (tracks = [], { targetDirectory = '', nombre = '', replacePath = null } = {}) => {
      const filePaths = tracks
        .map((track) => track?.filePath)
        .filter((filePath) => typeof filePath === 'string' && filePath.trim() !== '')

      if (filePaths.length === 0) {
        toast.error(t('playlists.exportEmpty'), {
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
          targetDirectory,
          targetPath: replacePath,
          nombre,
          persist: false
        })
      } catch (error) {
        toast.error(error?.message || t('playlists.saveFailed'), {
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
        toast.error(result?.error || t('playlists.saveFailed'), {
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

      toast.success(t('playlists.exported', { name: result.playlistName }), {
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
    [t]
  )

  const deleteDirectoryList = useCallback(async (path) => {
    await deleteDirectory(path)
    SetAllSongs([])
    allSongsLoadedPagesRef.current.clear()
    await getAllSongs(1, { reset: true })
  }, [deleteDirectory, getAllSongs])

  const getNews = useCallback(
    async () => ElectronGetter('get-new-audio-files', setNews, null, t('toasts.recentsLoaded')),
    [t]
  )

  useEffect(() => {
    const handleNotification = async (message) => {
      if (message?.type === 'toast') {
        const notify = message.variant === 'error' ? toast.error : toast.success
        notify(message.message || t('toasts.completed'), {
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
        return
      }

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

      toast.success(message || t('toasts.completed'), {
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
  }, [getAllSongs, getDirectories, t])

  useEffect(() => {
    const handlePlaylistDeleteCompleted = (result) => {
      const eventJobId = result?.jobId
      const eventPath = result?.path || pendingPlaylistDeleteJobsRef.current.get(eventJobId)

      if (eventJobId && processedPlaylistDeleteJobsRef.current.has(eventJobId)) {
        return
      }

      if (eventJobId) {
        processedPlaylistDeleteJobsRef.current.add(eventJobId)
        pendingPlaylistDeleteJobsRef.current.delete(eventJobId)
      }

      const deletedPlaylist = pendingPlaylistDeletesRef.current.get(eventPath)

      if (result?.success) {
        pendingPlaylistDeletesRef.current.delete(eventPath)
        setPlaylistsLoaded(false)
        setPlaylistsLastLoadedAt(Date.now())
        removeDeletingPlaylistPath(eventPath)
        showPlaylistDeleteToast(
          'success',
          deletedPlaylist?.nombre ? `Playlist deleted: ${deletedPlaylist.nombre}` : 'Playlist deleted.'
        )
        return
      }

      if (eventPath) {
        restoreOptimisticPlaylistDelete(eventPath)
      } else {
        void getSavedLists({ force: true })
      }

      showPlaylistDeleteToast('error', result?.error || t('playlists.saveFailed'))
    }

    window.electron.ipcRenderer.on('playlist-delete-completed', handlePlaylistDeleteCompleted)

    return () => {
      window.electron.ipcRenderer.off('playlist-delete-completed', handlePlaylistDeleteCompleted)
    }
  }, [getSavedLists, removeDeletingPlaylistPath, restoreOptimisticPlaylistDelete, showPlaylistDeleteToast, t])

  const contextValue = useMemo(
    () => ({
      allSongs,
      allSongsLoading,
      allSongsHasMore,
      allSongsPage,
      playlists,
      deletingPlaylistPaths,
      playlistsLoading,
      playlistsLoaded,
      playlistsLastLoadedAt,
      getSavedLists,
      addPlaylisthistory,
      deletePlaylist,
      isPlaylistDeleting,
      getUniqueList,
      getAllSongs,
      openM3U,
      randomPlaylist,
      updatePlaylistMetadata,
      news,
      getNews,
      currentCover,
      getRandomList,
      removeSongFromList,
      addSongToList,
      appendTracksToPlaylist,
      deleteDirectoryList,
      exportPlaylistTracks,
      exportPlaylistTracksToDirectory,
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
      currentCover,
      deleteDirectoryList,
      deletingPlaylistPaths,
      deletePlaylist,
      getAllSongs,
      getNews,
      getRandomList,
      getSavedLists,
      getUniqueList,
      isPlaylistDeleting,
      news,
      openM3U,
      playlists,
      playlistsLastLoadedAt,
      playlistsLoaded,
      playlistsLoading,
      randomPlaylist,
      removeSongFromList,
      exportPlaylistTracks,
      exportPlaylistTracksToDirectory,
      resolvePlaylistSaveDirectory,
      listPlaylistSaveDirectory,
      savePlaylistFromTracks,
      updatePlaylistMetadata
    ]
  )

  return <ContextLikes.Provider value={contextValue}>{children}</ContextLikes.Provider>
}
