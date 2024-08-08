/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useRef } from 'react'

// Crea el contexto
const AppContext = createContext()

// Crea un proveedor de contexto
export const AppProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const mediaRef = useRef(null)
  const [metadata, setMetadata] = useState(null)
  const [cola, setCola] = useState([])
  const [currentFile, setCurrentFile] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [emptyList, setEmptyList] = useState([])
  const [queue, setQueue] = useState([])
  const [likes, setLikes] = useState([])
  const [later, setLater] = useState([])
  const [history, setHistory] = useState([])
  const [m3ulists, setM3uLists] = useState([])
  const [directories, setDiretories] = useState([])
  const [currentLike, setCurrentLike] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)

  const saveCurrentTime = () => {
    setCurrentTime(mediaRef.current.currentTime)

    setIsPlaying(false)

    console.log(mediaRef.current.currentTime)
  }

  const loadCurrentTime = () => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = currentTime
      console.log(currentTime)

      setIsPlaying(true)
    }
  }

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.src = currentFile.filePath

      // Manejar eventos de reproducción
      mediaRef.current.onplay = () => {
        setIsPlaying(true)
      }

      mediaRef.current.onpause = () => {
        setIsPlaying(false)
      }
    }
    if (currentFile) {
      IsSongLiked('is-song-liked', currentFile.filePath, currentFile.fileName)
    }
  }, [currentFile.filePath, currentIndex])

  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

  const addItemToEmptyList = (item) => {
    setEmptyList([...emptyList, item])
  }

  const handleSongClick = (file, index, list) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(list)
    IsSongLiked('is-song-liked', file.filePath, file.fileName)
  }

  const handlePreviousClick = () => {
    const newIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1
    setCurrentIndex(newIndex)
    setCurrentFile(queue[newIndex])
  }

  const handleNextClick = () => {
    const newIndex = currentIndex === queue.length - 1 ? 0 : currentIndex + 1
    setCurrentIndex(newIndex)
    setCurrentFile(queue[newIndex])
  }
  const BinToBlob = (img, mimeType = 'image/png') => {
    if (img && img.data && img.type !== 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      return url
    }
    return 'https://i.pinimg.com/736x/ef/23/25/ef2325cedb047b8ac24fc2b718c15a30.jpg'
  }
  const togglePlayPause = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
      } else {
        mediaRef.current.play()
      }
    }
  }

  const handleGetBPMClick = async (filePath, common) => {
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('getbpm', filePath, common)
      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error getting BPM:', error)
    }
  }

  const handleSaveClick = async () => {
    const paths = queue.map((file) => file.filePath)

    try {
      const result = await window.electron.ipcRenderer.invoke('save-m3u', {
        filePaths: paths
      })
      if (result.success) {
        console.log('M3U file saved successfully at', result.path)
      } else {
        console.error('Failed to save M3U file:', result.error)
      }
    } catch (error) {
      console.error('Error communicating with main process:', error)
    }
  }

  const ElectronSetter = async (action, common, getter = undefined) => {
    const { filePath, fileName } = common
    console.log(filePath, fileName)
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke(action, filePath, fileName)
      if (getter) {
        getter()
      }

      console.log('File info:', fileInfo)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }
  const ElectronGetter = async (action, setState = null, filepath = null) => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke(action, filepath)
      if (fileInfos) {
        setState(fileInfos)
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const likesong = (common) => ElectronSetter('like-song', common)
  const latersong = (common) => ElectronSetter('listen-later-song', common)
  const addhistory = (common) => ElectronSetter('add-history', common)
  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes)
  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const getLikes = () => ElectronGetter('get-likes', setLikes)
  const getHistory = () => ElectronGetter('get-history', setHistory)
  const getlatersongs = () => ElectronGetter('get-listen-later', setLater)
  const selectFiles = () => ElectronGetter('select-files', setMetadata)
  const openM3U = () => ElectronGetter('open-m3u', setMetadata)
  const detectM3U = () => ElectronGetter('detect-m3u', setMetadata)
  const getSavedLists = () => ElectronGetter('get-playlists', setM3uLists)
  const getDirectories = () => ElectronGetter('get-all-directories', setDiretories)
  const getAllSongs = () => ElectronGetter('get-all-audio-files', setMetadata)
  const getUniqueList = (setState, filePath) => {
    ElectronGetter('open-list', setState, filePath)
    // Puedes realizar acciones adicionales con fileInfos si es necesario
  }

  const IsSongLiked = async (action = 'is-song-liked', filePath, fileName) => {
    console.log(filePath, fileName)
    try {
      const result = await window.electron.ipcRenderer.invoke(action, filePath, fileName)
      if (result.success) {
        if (action === 'is-song-liked') {
          const isLiked = result.liked
          console.log('Is the song liked?', isLiked)
          setCurrentLike(isLiked)

          // Aquí puedes manejar el estado 'isLiked' según lo necesites en tu aplicación.
        } else {
          console.log('File info:', result)
        }
      } else {
        console.error('Error:', result.error)
      }
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const deletePlaylist = (filePath) => {
    const setState = []
    ElectronGetter('delete-playlist', setState, filePath)

    // Puedes realizar acciones adicionales con fileInfos si es necesario
  }

  const deleteDirectory = (filePath) => {
    const setState = []
    getDirectories()
    ElectronGetter('delete-directory', setState, filePath)
  }

  const toggleLike = () => {
    if (currentFile && currentFile.filePath && currentFile.fileName) {
      if (currentLike) {
        unlikesong(currentFile)
        setCurrentLike(false)
      } else {
        likesong(currentFile)
        setCurrentLike(true)
      }
    } else {
      console.error('currentFile is undefined or missing required properties.')
    }
  }

  return (
    <AppContext.Provider
      value={{
        metadata,
        cola,
        currentFile,
        currentIndex,
        emptyList,
        queue,
        addItemToEmptyList,
        handleSongClick,
        handlePreviousClick,
        handleNextClick,
        handleGetBPMClick,
        handleSaveClick,
        selectFiles,
        openM3U,
        detectM3U,
        BinToBlob,
        mediaRef,
        isPlaying,
        togglePlayPause,

        likesong,
        getlikes: getLikes,
        unlikesong,
        likes,
        latersong,
        removelatersong,
        getlatersongs,
        later,
        addhistory,
        getHistory,
        history,
        m3ulists,
        getSavedLists,
        getUniqueList,
        deletePlaylist,
        getAllSongs,
        getDirectories,
        directories,
        deleteDirectory,
        IsSongLiked,
        currentLike,
        toggleLike,
        saveCurrentTime,
        loadCurrentTime
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// Hook personalizado para usar el contexto
export const useAppContext = () => {
  return useContext(AppContext)
}
