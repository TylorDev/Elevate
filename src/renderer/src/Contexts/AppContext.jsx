/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  ElectronGetter,
  ElectronSetter,
  electronInvoke,
  BinToBlob,
  ElectronSetter2,
  ElectronGetter2
} from './utils'
import { goToNext, goToPrevious, ToLike, toMute, toPlay, toRepeat, toShuffle } from './utilControls'
import { validateLike } from './utilMenu'

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
  const [originalQueue, setOriginalQueue] = useState([...queue])
  const [likes, setLikes] = useState([])
  const [later, setLater] = useState([])
  const [history, setHistory] = useState([])
  const [m3ulists, setM3uLists] = useState([])
  const [directories, setDiretories] = useState([])
  const [currentLike, setCurrentLike] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loop, setLoop] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [results, setResults] = useState([])
  const [most, setMost] = useState([])
  const [recents, setRecents] = useState([])
  //----------------controls

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queue, setCurrentIndex, setCurrentFile)
  }
  const handleNextClick = () => {
    goToNext(currentIndex, queue, setCurrentIndex, setCurrentFile)
  }
  const toggleShuffle = () => {
    toShuffle(isShuffled, queue, originalQueue, currentIndex, setQueue, setIsShuffled)
  }
  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  }
  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  }

  const toggleLike = () => {
    ToLike(currentFile, currentLike, likesong, unlikesong, setCurrentLike)
  }

  const likesong = (common) => ElectronSetter('like-song', common)
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
      isSongLiked(currentFile.filePath, currentFile.fileName)
    }
  }, [currentFile.filePath, currentIndex])

  //----------useEffect
  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

  useEffect(() => {
    getAllSongs()
    getLastSong()
    getRecents()
  }, [])

  useEffect(() => {
    const audio = mediaRef.current

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentFile.title ? currentFile.title : currentFile.fileName,
        artist: currentFile.artist || 'Unknown',
        album: 'Unknown',
        artwork: [
          {
            src: BinToBlob(currentFile?.picture?.[0] || {}),
            sizes: '300x300',
            type: 'image/jpeg'
          }
        ]
      })

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play()
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause()
      })

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(audio.currentTime - (details.seekOffset || 10), 0)
      })

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(audio.currentTime + (details.seekOffset || 10), audio.duration)
      })

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePreviousClick()
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextClick()
      })
    }
  }, [currentFile])

  //------------------menu buttons
  const isSongLiked = async (filePath, fileName) => {
    await validateLike(filePath, fileName, setCurrentLike)
  }

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('getbpm', common)

    if (fileInfo) {
      console.log('File info:', fileInfo.bpm)

      setMetadata((prevMetadata) =>
        (prevMetadata || []).map((item) => (item.filePath === fileInfo.filePath ? fileInfo : item))
      )

      setCurrentFile(fileInfo)
    }
  }

  const handleSongClick = (file, index, list) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(list)
    setOriginalQueue(list)
    isSongLiked(file.filePath, file.fileName)
    addhistory(file)
  }

  const addItemToEmptyList = (item) => {
    setEmptyList([...emptyList, item])
  }
  const latersong = (common) => ElectronSetter('listen-later-song', common)

  //---------------- system list
  const getAllSongs = () => ElectronGetter('get-all-audio-files', setMetadata)
  const getMost = () => ElectronGetter('get-most-played', setMost)
  const getLastSong = () => ElectronGetter('get-lastest', setCurrentFile)
  const addhistory = (common) => ElectronSetter('add-history', common)
  const getHistory = () => ElectronGetter('get-history', setHistory)
  const handleSaveClick = async () => {
    const paths = queue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }
  const getDirectories = () => ElectronGetter('get-all-directories', setDiretories)
  const getRecents = () => ElectronGetter('get-recents', setRecents)
  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes)
  const getlatersongs = () => ElectronGetter('get-listen-later', setLater)
  const removelatersong = (common) => ElectronSetter('remove-listen-later', common, getlatersongs)
  const getLikes = () => ElectronGetter('get-likes', setLikes)

  const deleteDirectory = (filePath) => {
    const setState = []
    getDirectories()
    ElectronGetter('delete-directory', setState, filePath)
  }
  const addPlaylisthistory = (path) => ElectronSetter2('add-list-to-history', path)
  //-----------UserLists
  const getSavedLists = () => ElectronGetter('get-playlists', setM3uLists)

  const getUniqueList = (setState, filePath) => {
    ElectronGetter('open-list', setState, filePath)
    // Puedes realizar acciones adicionales con fileInfos si es necesario
  }
  const deletePlaylist = (filePath) => {
    const setState = []
    ElectronGetter('delete-playlist', setState, filePath)

    // Puedes realizar acciones adicionales con fileInfos si es necesario
  }

  const openM3U = () => ElectronGetter('open-m3u', setMetadata)
  const searchSongs = (value) => ElectronGetter2('search', setResults, value)
  //Funciones no usadas
  const selectFiles = () => ElectronGetter('select-files', setMetadata)
  const detectM3U = () => ElectronGetter('detect-m3u', setMetadata)

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
        isSongLiked,
        currentLike,
        toggleLike,
        toggleMute,
        muted,
        toggleRepeat,
        loop,
        toggleShuffle,
        isShuffled,
        addPlaylisthistory,
        searchSongs,
        results,
        getMost,
        most,
        recents
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
