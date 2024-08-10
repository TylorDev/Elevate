import { useState, useEffect } from 'react'
import { useAppContext } from '../../Contexts/AppContext'
import { LuVolume2, LuVolumeX } from 'react-icons/lu'
import { TbRepeat, TbRepeatOff } from 'react-icons/tb'
import { LuListVideo, LuShuffle } from 'react-icons/lu'

import { useNavigate } from 'react-router-dom'
export const MediaTimeDisplay = () => {
  const { mediaRef, toggleMute, muted } = useAppContext()
  const { loop, toggleRepeat, toggleShuffle, isShuffled } = useAppContext()
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const navigate = useNavigate()

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
      <div className="time">
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
      <div className="time-buttons">
        <button onClick={toggleShuffle}>
          {isShuffled ? <LuShuffle color="#FF6337" /> : <LuShuffle color="#777" />}
        </button>

        <button onClick={toggleRepeat}>
          {loop ? <TbRepeat color="#FF6337" /> : <TbRepeatOff color="#777" />}{' '}
        </button>
        <button
          onClick={() => {
            navigate('/music')
          }}
        >
          <LuListVideo />
        </button>
      </div>
    </div>
  )
}
