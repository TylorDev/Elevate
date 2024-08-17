/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useEffect } from 'react'
import { ElectronGetter, ElectronSetter, electronInvoke, BinToBlob } from './utils'
import { ToLike } from './utilControls'
import { validateLike } from './utilMenu'
import { useSuper } from './SupeContext'

const AppContext = createContext()

export const AppProvider = ({ children }) => {
  const {
    mediaRef,
    currentFile,
    metadata,
    currentIndex,
    isShuffled,
    muted,
    isPlaying,
    loop,
    getAllSongs,
    selectFiles,
    openM3U,
    detectM3U,
    togglePlayPause,
    toggleMute,
    toggleRepeat,
    handleGetBPMClick,
    queueState,
    toggleShuffle,
    handlePreviousClick,
    handleNextClick,
    handleSaveClick,
    handleSongClick,
    addhistory
  } = useSuper()

  const [likeState, setLikeState] = useState({
    currentLike: false,
    likes: []
  })

  const isSongLiked = async (filePath, fileName) => {
    await validateLike(filePath, fileName, (isLiked) => {
      setLikeState((prevState) => ({ ...prevState, currentLike: isLiked }))
    })
  }

  const likesong = (common) => ElectronSetter('like-song', common)
  const getLikes = () =>
    ElectronGetter('get-likes', (likes) => {
      setLikeState((prevState) => ({ ...prevState, likes }))
    })
  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes)

  const toggleLike = () => {
    ToLike(currentFile, likeState.currentLike, likesong, unlikesong, (newLike) => {
      setLikeState((prevState) => ({ ...prevState, currentLike: newLike }))
    })
  }

  useEffect(() => {
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
        queue: queueState.queue,
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
        likes: likeState.likes,
        addhistory,
        getAllSongs,
        isSongLiked,
        currentLike: likeState.currentLike,
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
