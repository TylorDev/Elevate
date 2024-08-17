/* eslint-disable react/prop-types */
import { createContext, useContext } from 'react'
import { BinToBlob } from './utils'
import { useSuper } from './SupeContext'
const AppContext = createContext()
export const AppProvider = ({ children }) => {
  const {
    mediaRef, // player
    currentFile, //player
    currentIndex, //player
    isShuffled, //player
    muted, //player
    isPlaying, //player
    loop, //player
    togglePlayPause, //player
    toggleMute, //player
    toggleRepeat, //player
    toggleShuffle, //player
    handlePreviousClick, //player
    handleNextClick, //player
    handleSongClick, // utils
    addhistory, // utils
    handleGetBPMClick // utils
  } = useSuper()

  return (
    <AppContext.Provider
      value={{
        currentFile,
        currentIndex,
        queue: queueState.queue,
        handleSongClick,
        handlePreviousClick,
        handleNextClick,
        handleGetBPMClick,
        handleSaveClick,
        BinToBlob,
        mediaRef,
        isPlaying,
        togglePlayPause,
        addhistory,
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
