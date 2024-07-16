/* eslint-disable react/prop-types */
import './AudioPlayer.scss'
import { useAppContext } from './Contexts/AppContext'
import { Controls } from './Controls'
import { useRef, useState, useEffect } from 'react'
export function AudioPlayer() {
  const { currentFile, handleNextClick, handlePreviousClick, metadata, emptyList, queue } =
    useAppContext()

  const next = () => handleNextClick(queue === 'tracks' ? metadata : emptyList)
  const previus = () => handlePreviousClick(queue === 'tracks' ? metadata : emptyList)

  const BinToBlob = (img, mimeType = 'image/png') => {
    if (img && img.data && img.type !== 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      return url
    }
    return 'https://i.pinimg.com/564x/ca/2d/fe/ca2dfe6759c3e0183f83617364edbe2c.jpg'
  }
  const mediaRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.src = currentFile.filePath
      mediaRef.current.play()
    }
  }, [currentFile.filePath])

  const togglePlayPause = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
      } else {
        mediaRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="AudioPlayer">
      <div className="cover">
        <img src={BinToBlob(currentFile?.picture?.[0] || {})} alt="" />
      </div>
      <div className="data">
        <div>{currentFile.title ? currentFile.title : currentFile.fileName}</div>
        <div>{currentFile.artist}</div>
        <div>{currentFile.BPM}</div>
      </div>
      <Controls
        handlePreviousClick={previus}
        handleNextClick={next}
        togglePlayPause={togglePlayPause}
        isPlaying={isPlaying}
      />

      <div className="audiosrc">
        <audio ref={mediaRef} controls autoPlay onEnded={next} style={{ display: 'none' }}>
          <source src={currentFile.filePath} type="audio/mpeg" />
          Tu navegador no soporta el elemento de audio.
        </audio>
        <MediaTimeDisplay mediaRef={mediaRef} />
      </div>
    </div>
  )
}

const MediaTimeDisplay = ({ mediaRef }) => {
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
    <div>
      <div
        style={{ position: 'relative', width: '95%', height: '10px', backgroundColor: '#ddd' }}
        onClick={handleTimelineClick}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(progress / duration) * 100}%`,
            backgroundColor: '#2196F3'
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

      <div
        className="volume-control"
        onClick={handleVolumeChange}
        style={{
          position: 'relative',
          width: '50%',
          height: '20px',
          backgroundColor: '#ddd',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            position: 'absolute',
            height: '100%',
            backgroundColor: 'green',
            width: `${volume * 100}%`
          }}
        />
      </div>
    </div>
  )
}
