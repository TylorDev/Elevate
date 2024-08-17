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
    detectM3U,
    togglePlayPause,
    toggleMute,
    toggleRepeat,
    handleGetBPMClick
  } = useSuper()

  const [queue, setQueue] = useState([])
  const [originalQueue, setOriginalQueue] = useState([...queue])
  const [currentLike, setCurrentLike] = useState(false)
  const [likes, setLikes] = useState([])
  const isSongLiked = async (filePath, fileName) => {
    await validateLike(filePath, fileName, setCurrentLike)
  }
  const likesong = (common) => ElectronSetter('like-song', common)
  const getLikes = () => ElectronGetter('get-likes', setLikes)
  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes)
  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queue, CurrentIndexSetter, CurrentFileSetter)
  }
  const handleNextClick = () => {
    goToNext(currentIndex, queue, CurrentIndexSetter, CurrentFileSetter)
  }
  const addhistory = (common) => ElectronSetter('add-history', common) //1 ref

  const handleSaveClick = async () => {
    const paths = queue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }
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
  }

  const toggleLike = () => {
    ToLike(currentFile, currentLike, likesong, unlikesong, setCurrentLike)
  }

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick)
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
function WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick) {
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
}
