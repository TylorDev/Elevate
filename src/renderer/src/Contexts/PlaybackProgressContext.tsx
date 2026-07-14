import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { usePlayback } from './PlaybackContext'

const PlaybackProgressContext = createContext({ progress: 0, duration: 0 })

export const PlaybackProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const progressRafRef = useRef(null)
  const { mediaRef, mediaElement } = usePlayback()

  useEffect(() => {
    if (!mediaElement) return

    const audio = mediaElement

    const updateProgress = () => {
      if (progressRafRef.current) window.cancelAnimationFrame(progressRafRef.current)
      progressRafRef.current = window.requestAnimationFrame(() => {
        setProgress(audio.currentTime)
      })
    }

    const updateDuration = () => {
      setDuration(audio.duration || 0)
    }

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('durationchange', updateDuration)

    return () => {
      if (progressRafRef.current) window.cancelAnimationFrame(progressRafRef.current)
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('durationchange', updateDuration)
    }
  }, [mediaElement])

  const handleTimelineClick = (event) => {
    const timeline = event.currentTarget

    if (!timeline || !mediaRef.current) return

    const timelineWidth = timeline.clientWidth
    const clickPosition = Math.max(0, Math.min(event.nativeEvent.offsetX, timelineWidth))
    const mediaDuration = mediaRef.current.duration || 0
    const newTime = (clickPosition / timelineWidth) * mediaDuration

    mediaRef.current.currentTime = newTime
  }

  const contextValue = useMemo(
    () => ({
      progress,
      duration,
      handleTimelineClick
    }),
    [duration, progress]
  )

  return (
    <PlaybackProgressContext.Provider value={contextValue}>
      {children}
    </PlaybackProgressContext.Provider>
  )
}

export const usePlaybackProgress = () => useContext(PlaybackProgressContext)
