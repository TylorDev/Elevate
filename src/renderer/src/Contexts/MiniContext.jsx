import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  createLatestOnlyInvoker,
  ElectronDelete,
  ElectronGetter,
  ElectronGetter2,
  ElectronSetter
} from './utils'
import { useImages } from './ImagesContext'

// Crear el contexto
const MiniContext = createContext()

// Proveedor del contexto
export const MiniProvider = ({ children }) => {
  const [recents, setRecents] = useState([])
  const getRecents = useCallback(
    () => ElectronGetter('get-recents', setRecents, null, 'Recientes obtenidos!'),
    []
  )

  const [most, setMost] = useState([])
  const getMost = useCallback(
    () => ElectronGetter('get-most-played', setMost, null, 'Mas eschados cargados!'),
    []
  )

  const [directories, setDiretories] = useState([])
  const [directoriesLoading, setDirectoriesLoading] = useState(false)
  const [directoriesLoaded, setDirectoriesLoaded] = useState(false)
  const directoriesRequestRef = useRef(null)
  const directoriesInvokerRef = useRef(createLatestOnlyInvoker())
  const [scanProgress, setScanProgress] = useState(null)
  const [history, setHistory] = useState([])
  const [later, setLater] = useState([])
  const [lista, setLista] = useState([])
  const { getCollectionCoverUrl } = useImages()

  // Función para eliminar un elemento por su índice
  const eliminarElemento = useCallback((elemento) => {
    if (elemento === null || elemento === undefined) {
      console.error('Elemento no puede ser nulo o indefinido.')
      return
    }

    setLista((currentList) => {
      const existe = currentList.some((item) => item.filePath === elemento.filePath)

      if (!existe) {
        console.warn('Elemento no encontrado en la lista.')
        return currentList
      }

      return currentList.filter((item) => item.filePath !== elemento.filePath)
    })
  }, [])

  const getDirectories = useCallback(async ({ force = false } = {}) => {
    if (!force && directoriesLoaded) {
      return directories
    }

    if (directoriesRequestRef.current && !force) {
      return directoriesRequestRef.current
    }

    setDirectoriesLoading(true)

    const request = directoriesInvokerRef.current('get-all-directories', force ? Date.now() : null)
      .then(({ isLatest, result }) => {
        if (isLatest && result) {
          setDiretories(result)
          setDirectoriesLoaded(true)
        }

        return result
      })
      .catch((error) => {
        console.error('Error loading directories:', error)
        throw error
      })
      .finally(() => {
        if (directoriesRequestRef.current === request) {
          directoriesRequestRef.current = null
          setDirectoriesLoading(false)
        }
      })

    directoriesRequestRef.current = request
    return request
  }, [directories, directoriesLoaded])

  const deleteDirectory = useCallback(async (path) => {
    await ElectronDelete('delete-directory', path, 'directorio eliminado!')
    setDiretories((preDir) => preDir.filter((dir) => dir.path !== path))
    setDirectoriesLoaded(false)
  }, [])

  const addDirectory = useCallback(async (directoryPath = null) => {
    const normalizedPath =
      directoryPath && typeof directoryPath === 'object' && 'nativeEvent' in directoryPath
        ? null
        : directoryPath

    const result = await ElectronGetter(
      'add-directory',
      null,
      normalizedPath,
      'Directorio agregado!'
    )

    if (result) {
      await getDirectories({ force: true })
    }

    return result
  }, [getDirectories])

  const getDirFiles = useCallback((setState, value) => {
    ElectronGetter2('get-audio-in-directory', setState, value)
  }, [])

  // Listen for directory changes from the watcher and scan progress
  const getDirectoriesRef = useRef(getDirectories)
  getDirectoriesRef.current = getDirectories

  useEffect(() => {
    const handleDirectoryNotification = (message) => {
      if (message === '[directory-changed]') {
        getDirectoriesRef.current({ force: true })
        setScanProgress(null)
        return
      }

      // Handle scan progress messages
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : message
        if (parsed?.type === 'scan-progress') {
          setScanProgress({
            dirPath: parsed.dirPath,
            processed: parsed.processed,
            total: parsed.total
          })
        }
      } catch {
        // Not a JSON message, ignore
      }
    }

    window.electron.ipcRenderer.on('notification', handleDirectoryNotification)
    return () => {
      window.electron.ipcRenderer.off('notification', handleDirectoryNotification)
    }
  }, [])

  const getHistory = useCallback((page = 1) =>
    ElectronGetter('get-history', setHistory, page, 'se obtuvo el historial')
  , [])

  const getlatersongs = useCallback(async () => {
    await ElectronGetter(
      'get-listen-later',
      (laterData) => {
        setLater({
          ...laterData,
          cover: getCollectionCoverUrl('Later', laterData.cover)
        })
      },
      null,
      'listen later cargados!'
    )
  }, [getCollectionCoverUrl])

  const removelatersong = useCallback((common) => ElectronSetter('remove-listen-later', common, getlatersongs), [getlatersongs])
  const latersong = useCallback((common) => ElectronSetter('listen-later-song', common), [])
  const getTotalTracks = useCallback((setState) => {
    ElectronGetter2('get-all-audio-files-number', setState)
  }, [])
  const getTotalLikes = useCallback((setState) => {
    ElectronGetter2('get-likes-number', setState)
  }, [])
  const getTotalLists = useCallback((setState) => {
    ElectronGetter2('get-playlists-number', setState)
  }, [])

  const contextValue = useMemo(() => ({
        recents,
        getRecents,
        most,
        getMost,
        directories,
        directoriesLoading,
        directoriesLoaded,
        scanProgress,
        addDirectory,
        getDirectories,
        deleteDirectory,
        getDirFiles,
        history,
        getHistory,
        later,
        getlatersongs,
        removelatersong,
        latersong,
        lista,
        eliminarElemento,
        getTotalTracks,
        getTotalLikes,
        getTotalLists
      }), [
        recents,
        getRecents,
        most,
        getMost,
        directories,
        directoriesLoading,
        directoriesLoaded,
        scanProgress,
        addDirectory,
        getDirectories,
        deleteDirectory,
        getDirFiles,
        history,
        getHistory,
        later,
        getlatersongs,
        removelatersong,
        latersong,
        lista,
        eliminarElemento,
        getTotalTracks,
        getTotalLikes,
        getTotalLists
      ])
  return (
    <MiniContext.Provider value={contextValue}>
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
