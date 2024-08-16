/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { BinToBlob } from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const handleSongClick = (file, index, list) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueue(list)
    setOriginalQueue(list)
  } //0 ref

  const mediaRef = useRef(null)
  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check
  const [queue, setQueue] = useState([]) // 5 ref  - 2 ref
  const [originalQueue, setOriginalQueue] = useState([...queue]) // 1 ref check

  const togglePlayPause = () => {
    toPlay(mediaRef, isPlaying)
  } //0 ref
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  } //0 ref
  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  } //0 ref

  const handlePreviousClick = () => {
    goToPrevious(currentIndex, queue, setCurrentIndex, setCurrentFile)
  } //1 ref
  const handleNextClick = () => {
    goToNext(currentIndex, queue, setCurrentIndex, setCurrentFile)
  } //1 ref
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
  }, [currentFile.filePath, currentIndex])

  const toggleShuffle = () => {
    toShuffle(isShuffled, queue, originalQueue, currentIndex, setQueue, setIsShuffled)
  } //0 ref

  return <SuperContext.Provider value={{ mediaRef }}>{children}</SuperContext.Provider>
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
