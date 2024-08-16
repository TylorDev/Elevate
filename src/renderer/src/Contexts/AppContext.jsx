/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { ElectronGetter, ElectronSetter, electronInvoke, BinToBlob } from './utils'
import { goToNext, goToPrevious, ToLike, toMute, toPlay, toRepeat, toShuffle } from './utilControls'
import { validateLike } from './utilMenu'
import { useSuper } from './SupeContext'

const AppContext = createContext()

export const AppProvider = ({ children }) => {
  const {
    mediaRef,
    currentFile,
    CurrentFileSetter,
    metadata,
    MetadataSetter,
    currentIndex,
    CurrentIndexSetter,
    isShuffled,
    IsShuffledSetter,
    muted,
    MutedSetter,
    isPlaying,
    IsPlayingSetter,
    loop,
    LoopSetter,
    getAllSongs,
    selectFiles,
    openM3U,
    detectM3U
  } = useSuper()

  const [queue, setQueue] = useState([]) // 5 ref  - 2 ref
  const [originalQueue, setOriginalQueue] = useState([...queue]) // 1 ref check
  const [currentLike, setCurrentLike] = useState(false) // 1 ref  -  2 ref
  const [cola, setCola] = useState([]) // 0 ref  -  1 ref
  const [likes, setLikes] = useState([]) // 1 ref   check

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
    goToPrevious(currentIndex, queue, CurrentIndexSetter, CurrentFileSetter)
  } //1 ref
  const handleNextClick = () => {
    goToNext(currentIndex, queue, CurrentIndexSetter, CurrentFileSetter)
  } //1 ref

  const addhistory = (common) => ElectronSetter('add-history', common) //1 ref

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('getbpm', common)

    if (fileInfo) {
      console.log('File info:', fileInfo.bpm)

      MetadataSetter((prevMetadata) =>
        (prevMetadata || []).map((item) => (item.filePath === fileInfo.filePath ? fileInfo : item))
      )

      CurrentFileSetter(fileInfo)
    }
  }

  const handleSaveClick = async () => {
    const paths = queue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  } //0 ref

  const handleSongClick = (file, index, list) => {
    CurrentFileSetter(file)
    CurrentIndexSetter(index)
    setQueue(list)
    setOriginalQueue(list)
    isSongLiked(file.filePath, file.fileName)
    addhistory(file)
  } //0 ref

  const toggleShuffle = () => {
    toShuffle(isShuffled, queue, originalQueue, currentIndex, setQueue, IsShuffledSetter)
  } //0 ref
  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  } //0 ref
  const toggleMute = () => {
    toMute(mediaRef, muted, MutedSetter)
  } //0 ref
  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, LoopSetter)
  } //0 ref

  const toggleLike = () => {
    ToLike(currentFile, currentLike, likesong, unlikesong, setCurrentLike)
  } //0 ref

  //----------useEffect
  useEffect(() => {
    if (metadata && Array.isArray(metadata)) {
      const filePaths = metadata.map((file) => file.filePath)
      setCola(filePaths)
    }
  }, [metadata])

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
        IsPlayingSetter(true)
      }

      mediaRef.current.onpause = () => {
        IsPlayingSetter(false)
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
