/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { ElectronGetter, ElectronSetter, electronInvoke, BinToBlob, ElectronSetter2 } from './utils'
import { goToNext, goToPrevious, ToLike, toMute, toPlay, toRepeat, toShuffle } from './utilControls'
import { validateLike } from './utilMenu'

// Crea el contexto
const AppContext = createContext()

// Crea un proveedor de contexto
export const AppProvider = ({ children }) => {
  const [queue, setQueue] = useState([]) // 5 ref  - 2 ref
  const [originalQueue, setOriginalQueue] = useState([...queue]) // 1 ref check
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const mediaRef = useRef(null) //2  ref
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check
  const [metadata, setMetadata] = useState(null) // 1 ref - 5ref
  const [currentLike, setCurrentLike] = useState(false) // 1 ref  -  2 ref
  const [cola, setCola] = useState([]) // 0 ref  -  1 ref
  const [likes, setLikes] = useState([]) // 1 ref   check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check

  //Like
  const isSongLiked = async (filePath, fileName) => {
    await validateLike(filePath, fileName, setCurrentLike)
  } //2 ref

  const likesong = (common) => ElectronSetter('like-song', common) //1 ref
  const getLikes = () => ElectronGetter('get-likes', setLikes) //1 ref
  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes) //1 ref
  //CurrentFile
  //Metadata
  //Queue

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queue, setCurrentIndex, setCurrentFile)
  } //1 ref
  const handleNextClick = () => {
    goToNext(currentIndex, queue, setCurrentIndex, setCurrentFile)
  } //1 ref

  const getAllSongs = () => ElectronGetter('get-all-audio-files', setMetadata) //1 ref

  const addhistory = (common) => ElectronSetter('add-history', common) //1 ref

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('getbpm', common)

    if (fileInfo) {
      console.log('File info:', fileInfo.bpm)

      setMetadata((prevMetadata) =>
        (prevMetadata || []).map((item) => (item.filePath === fileInfo.filePath ? fileInfo : item))
      )

      setCurrentFile(fileInfo)
    }
  } //0 ref

  const handleSaveClick = async () => {
    const paths = queue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  } //0 ref

  const getLastSong = () => ElectronGetter('get-lastest', setCurrentFile) //0 ref

  const handleSongClick = (file, index, list) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(list)
    setOriginalQueue(list)
    isSongLiked(file.filePath, file.fileName)
    addhistory(file)
  } //0 ref

  const openM3U = () => ElectronGetter('open-m3u', setMetadata) // 0 ref

  const selectFiles = () => ElectronGetter('select-files', setMetadata) // 0 ref
  const detectM3U = () => ElectronGetter('detect-m3u', setMetadata) //   0 ref

  const toggleShuffle = () => {
    toShuffle(isShuffled, queue, originalQueue, currentIndex, setQueue, setIsShuffled)
  } //0 ref
  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  } //0 ref
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  } //0 ref
  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  } //0 ref

  const toggleLike = () => {
    ToLike(currentFile, currentLike, likesong, unlikesong, setCurrentLike)
  } //0 ref

  //Mover

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

  return (
    <AppContext.Provider
      value={{
        metadata,
        cola,
        currentFile,
        currentIndex,
        queue,
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
        addhistory,
        getAllSongs,
        isSongLiked,
        currentLike,
        toggleLike,
        toggleMute,
        muted,
        toggleRepeat,
        loop,
        toggleShuffle,
        isShuffled
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
