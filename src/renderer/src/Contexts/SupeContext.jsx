/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { BinToBlob, ElectronGetter, electronInvoke } from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check
  const [metadata, setMetadata] = useState(null) // 1 ref - 5 ref

  const Setter = (setter, value) => {
    setter(value)
  }

  const MetadataSetter = (data) => Setter(setMetadata, data)
  const CurrentFileSetter = (file) => Setter(setCurrentFile, file)
  const CurrentIndexSetter = (index) => Setter(setCurrentIndex, index)
  const IsShuffledSetter = (value) => Setter(setIsShuffled, value)
  const MutedSetter = (value) => Setter(setMuted, value)
  const LoopSetter = (value) => Setter(setLoop, value)
  const IsPlayingSetter = (value) => Setter(setIsPlaying, value)

  const getLastSong = () => ElectronGetter('get-lastest', setCurrentFile) //0 ref
  const getAllSongs = () => ElectronGetter('get-all-audio-files', setMetadata) //1 ref

  const openM3U = () => ElectronGetter('open-m3u', MetadataSetter) // 0 ref
  const selectFiles = () => ElectronGetter('select-files', MetadataSetter) // 0 ref
  const detectM3U = () => ElectronGetter('detect-m3u', MetadataSetter) //   0 ref

  useEffect(() => {
    getAllSongs()
    getLastSong()
  }, [])

  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, MutedSetter)
  }

  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, LoopSetter)
  }

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

  return (
    <SuperContext.Provider
      value={{
        mediaRef,
        currentFile,
        CurrentFileSetter,
        currentIndex,
        CurrentIndexSetter,
        isShuffled,
        IsShuffledSetter,
        muted,
        MutedSetter,
        loop,
        LoopSetter,
        isPlaying,
        IsPlayingSetter,
        metadata,
        MetadataSetter,
        getAllSongs,
        openM3U,
        selectFiles,
        detectM3U,
        togglePlayPause,
        toggleMute,
        toggleRepeat,
        handleGetBPMClick
      }}
    >
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
