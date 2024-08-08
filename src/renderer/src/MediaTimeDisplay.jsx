import { useState, useEffect } from 'react'
import { useAppContext } from './Contexts/AppContext'
import { LuVolume2, LuVolumeX } from 'react-icons/lu'
export const MediaTimeDisplay = () => {
  const { mediaRef, toggleMute, muted } = useAppContext()

  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      setProgress(mediaRef.current.currentTime)
    }

    const updateDuration = () => {
      setDuration(mediaRef.current.duration)
    }

    if (mediaRef.current) {
      mediaRef.current.addEventListener('timeupdate', updateProgress)
      mediaRef.current.addEventListener('loadedmetadata', updateDuration)
      mediaRef.current.addEventListener('durationchange', updateDuration)
    }

    return () => {
      if (mediaRef.current) {
        mediaRef.current.removeEventListener('timeupdate', updateProgress)
        mediaRef.current.removeEventListener('loadedmetadata', updateDuration)
        mediaRef.current.removeEventListener('durationchange', updateDuration)
      }
    }
  }, [mediaRef])

  const handleTimelineClick = (e) => {
    // Obtiene el contenedor de la línea de tiempo
    const timeline = e.currentTarget

    // Verifica si el contenedor es válido
    if (!timeline || !mediaRef.current) return

    // Obtiene el ancho del contenedor de la línea de tiempo
    const timelineWidth = timeline.clientWidth

    // Asegura que el clic se realizó dentro del contenedor
    const clickPosition = Math.max(0, Math.min(e.nativeEvent.offsetX, timelineWidth))

    // Calcula el nuevo tiempo en la línea de tiempo
    const newTime = (clickPosition / timelineWidth) * duration

    // Actualiza el tiempo actual del medio
    mediaRef.current.currentTime = newTime
  }
  const [volume, setVolume] = useState(1)
  const handleVolumeChange = (e) => {
    const volumeSlider = e.currentTarget
    const volumeWidth = volumeSlider.clientWidth
    const clickPosition = Math.max(0, Math.min(e.nativeEvent.offsetX, volumeWidth))
    const newVolume = clickPosition / volumeWidth

    if (mediaRef.current) {
      mediaRef.current.volume = newVolume
    }

    setVolume(newVolume)
  }

  return (
    <div className="timeline">
      <div id="Otimeline" onClick={handleTimelineClick}>
        <div
          id="Itimeline"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(progress / duration) * 100}%`
          }}
        />
      </div>
      <div>
        {Math.floor(progress / 60)}:
        {Math.floor(progress % 60)
          .toString()
          .padStart(2, '0')}{' '}
        /{Math.floor(duration / 60)}:
        {Math.floor(duration % 60)
          .toString()
          .padStart(2, '0')}
      </div>
      <div className="o-vol">
        {muted ? <LuVolumeX onClick={toggleMute} /> : <LuVolume2 onClick={toggleMute} />}

        <div className="volume-control" onClick={handleVolumeChange}>
          <div
            style={{
              width: `${volume * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
