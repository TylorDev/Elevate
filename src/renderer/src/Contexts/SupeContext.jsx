import { createContext, useContext, useRef, useEffect, useState, useMemo } from 'react'
import { dataToImageUrl, electronInvoke, ElectronSetter, WindowsPlayer } from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'
import { useNavigate } from 'react-router-dom'
import { Bounce, toast } from 'react-toastify'
import { useCoverUrl } from '../hooks/useCoverUrl'
import { extractDominantColor } from '../utils/useDominantColor'
import { useSession } from './SessionContext'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const scrollRef = useRef(null)
  const listenersAttached = useRef(false)
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const {
    queueState,
    setQueueState,
    currentFile,
    setCurrentFile,
    currentIndex,
    setCurrentIndex,
    isShuffled,
    setIsShuffled
  } = useSession()

  const [isAwaken, setIsAwaken] = useState(false)
  const [waveformVariant, setWaveformVariant] = useState(
    () => localStorage.getItem('waveformVariant') || 'mirrored'
  )

  const handleWaveformVariantChange = (variant) => {
    setWaveformVariant(variant)
    localStorage.setItem('waveformVariant', variant)
  }

  const imagesRef = useRef(new Map())

  const handleAwaken = (value) => {
    setIsAwaken(value)
  }
  const getImage = (name, data) => {
    // Verificar si la imagen ya existe
    const existingImage = imagesRef.current.get(name)

    if (existingImage) {
      // Logear el nombre y la URL existente
      // console.log(
      //   `La imagen con el nombre "${name}" ya existe. URL generada anteriormente: ${existingImage.url}`
      // )
      return existingImage
    }

    // Generar la nueva URL
    const url = dataToImageUrl(data)

    imagesRef.current.set(name, url)

    return url
  }

  const [isAtEnd, setIsAtEnd] = useState(false) // Estado que indica si estamos al final del scroll

  const handleScroll = () => {
    const element = scrollRef.current
    if (element) {
      // Calcular el porcentaje restante
      const remainingScroll = element.scrollHeight - element.scrollTop - element.clientHeight
      const threshold = element.scrollHeight * 0.1 // 10% del total

      // Si el remainingScroll es menor o igual al 10% de la altura total, se marca como "al final"
      const isNearEnd = remainingScroll <= threshold

      if (isNearEnd) console.log('Estás a un 90% del final')

      setIsAtEnd(isNearEnd)
    }
  }

  const navigate = useNavigate()

  const PlayQueue = (list, name, index = null) => {
    if (index) {
      setCurrentFile(list[index])
      setQueueState({
        currentQueue: list,
        originalQueue: list,
        queueName: name
      })
      setCurrentIndex(index) // Establece el índice al de la canción proporcionada
    } else if (list.length > 0) {
      setCurrentFile(list[0])
      setQueueState({
        currentQueue: list,
        originalQueue: list,
        queueName: name
      })
      setCurrentIndex(0) // Restablecer el índice a 0
    } else {
      // Manejar el caso en que la lista está vacía
      setCurrentFile('')
      setQueueState({
        currentQueue: [],
        originalQueue: [],
        queueName: name
      })
      setCurrentIndex(0)
    }
  }

  const handleQueueAndPlay = async (song = undefined, index = undefined, filePath, shouldNavigate = true) => {
    if (filePath.startsWith('folder:')) {
      const newFilePath = filePath.replace(/^folder:/, '')
      if (shouldNavigate) {
        navigate(`/directories/${encodeURIComponent(newFilePath)}/false?song=${encodeURIComponent(song.filePath)}`)
      }
      setCurrentFile(song)
      setCurrentIndex(index)
      const newQueue = await window.electron.ipcRenderer.invoke(
        'get-audio-in-directory',
        newFilePath
      )
      if (newQueue) {
        setQueueState((prevState) => ({
          queueName: filePath,
          currentQueue: newQueue,
          originalQueue: newQueue
        }))
      }
      return
    }

    try {
      const newQueue = await window.electron.ipcRenderer.invoke('get-list', filePath)

      if (newQueue) {
        const processedQueue = newQueue.processedData
        setQueueState((prevState) => ({
          queueName: filePath,
          currentQueue: processedQueue,
          originalQueue: processedQueue
        }))

        if (shouldNavigate) {
          navigate(`/playlists/${filePath}`)
        }

        if (processedQueue && processedQueue.length > 0) {
          setCurrentFile(song || processedQueue[0])
          setCurrentIndex(index || 0)
        } else {
          console.error('Processed queue is empty')
        }
      }
    } catch (error) {
      console.error('Error handling queue or file infos:', error)
    }
  }

  useEffect(() => {
    const element = scrollRef.current
    if (element) {
      element.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (element) {
        element.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  const updateProgressRef = useRef(null)
  const updateDurationRef = useRef(null)
  const progressRafRef = useRef(null)

  useEffect(() => {
    if (!mediaRef.current) return

    const audio = mediaRef.current

    const updateProgress = () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current)
      progressRafRef.current = requestAnimationFrame(() => {
        setProgress(audio.currentTime)
      })
    }

    const updateDuration = () => {
      setDuration(audio.duration || 0)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => handleNextClick()

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current)
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [queueState.currentQueue, currentIndex]) // Depend on these to keep handleNextClick fresh if needed, or use a ref for handleNextClick

  useEffect(() => {
    if (mediaRef.current) {
      let filePath = currentFile?.filePath
        ? currentFile.filePath.replace(/\\/g, '/').replace(/#/g, '%23')
        : null
      if (filePath && /^([a-zA-Z]):/.test(filePath)) {
        filePath = `file:///${filePath}`
      }
      mediaRef.current.src = filePath || ''
    }
  }, [currentFile?.filePath])

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick)
  }, [currentFile])




  const handlePreviousClick = () => {
    if (currentIndex > 0) {
      goToPrevious(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }

  const handleNextClick = () => {
    if (currentIndex < queueState.currentQueue.length - 1) {
      goToNext(currentIndex, queueState.currentQueue, setCurrentIndex, setCurrentFile)
    }
  }

  const togglePlayPause = () => {
    if (!currentFile?.filePath && queueState.currentQueue.length > 0) {
      setCurrentFile(queueState.currentQueue[0])
      setCurrentIndex(0)
    } else {
      toPlay(mediaRef, isPlaying)
    }
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
  }

  const setMediaVolume = (value) => {
    const nextVolume = Math.max(0, Math.min(1, Number(value) || 0))
    setVolume(nextVolume)

    if (mediaRef.current) {
      mediaRef.current.volume = nextVolume
      mediaRef.current.muted = nextVolume === 0
    }

    setMuted(nextVolume === 0)
  }

  const [isStep, setIsStep] = useState(false)
  const minVolume = 0.02 // Define el volumen mínimo permitido

  // Función para hacer fade out
  const fadeOut = (duration) => {
    const interval = 50 // Intervalo en milisegundos
    const steps = duration / interval // Número de pasos
    const stepVolume = (mediaRef.current.volume - minVolume) / steps // Reducción del volumen por paso

    let currentStep = 0

    const fadeOutInterval = setInterval(() => {
      if (currentStep < steps) {
        mediaRef.current.volume -= stepVolume // Reducir el volumen
        // Asegurarse de no bajar del volumen mínimo
        if (mediaRef.current.volume < minVolume) {
          mediaRef.current.volume = minVolume
        }
        currentStep++
      } else {
        clearInterval(fadeOutInterval) // Detener el intervalo
      }
    }, interval)
  }

  // Función para hacer fade in
  const fadeIn = (duration) => {
    const interval = 50 // Intervalo en milisegundos
    const steps = duration / interval // Número de pasos
    const stepVolume = (1 - mediaRef.current.volume) / steps // Incremento del volumen por paso

    let currentStep = 0

    const fadeInInterval = setInterval(() => {
      if (currentStep < steps) {
        mediaRef.current.volume += stepVolume // Aumentar el volumen
        // Asegurarse de no sobrepasar el volumen máximo (1.0)
        if (mediaRef.current.volume > 1.0) {
          mediaRef.current.volume = 1.0
        }
        currentStep++
      } else {
        clearInterval(fadeInInterval) // Detener el intervalo
      }
    }, interval)
  }

  const toggleStep = () => {
    if (!isStep) {
      // Si no está activo, activar el step
      setIsStep(true)
      fadeOut(1000) // Hacer fade out en 2 segundos al 10% de volumen

      // Restablecer el estado después de 60 segundos
      setTimeout(() => {
        fadeIn(1000) // Hacer fade in en 2 segundos al 100% de volumen
        setIsStep(false)
      }, 45000) // 60000 ms = 60 s
    } else {
      // Si está activo, restaurar el volumen inmediatamente
      fadeIn(1000) // Hacer fade in en 2 segundos al 100% de volumen
      setIsStep(false)
    }
  }
  const toggleRepeat = () => {
    toRepeat(mediaRef, loop, setLoop)
  }

  const handleGetBPMClick = async (common) => {
    const fileInfo = await electronInvoke('get-bpm', common)

    if (fileInfo) {
      setCurrentFile(fileInfo)
    }
  }

  const toggleShuffle = () => {
    toShuffle(
      isShuffled,
      queueState.currentQueue,
      queueState.originalQueue,
      currentIndex,
      (newQueue) => {
        setQueueState((prevState) => ({ ...prevState, currentQueue: newQueue }))
      },
      setIsShuffled
    )
    navigate('/music')
  }

  const handleSaveClick = async () => {
    const paths = queueState.currentQueue.map((file) => file.filePath)
    const result = await electronInvoke('save-m3u', { filePaths: paths })
    if (result && result.success) {
      console.log('M3U file saved successfully at', result.path)
    }
  }

  const removeTrack = async (playlistPath, index) => {
    const result = await electronInvoke('update-list', {
      filePath: playlistPath,
      index
    })

    // Manejar el resultado de la operación
    if (result && result.success) {
      setQueueState((prevState) => ({
        ...prevState,
        currentQueue: prevState.currentQueue.filter((_, i) => i !== index)
      }))

      setTimeout(() => {
        toast.success('Eliminada correctamente!', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })
      }, 1000)
    }
  }

  const addSong = async (playlistPath, newTrack) => {
    const result = await electronInvoke('add-new-song', {
      filePath: playlistPath,
      song: newTrack.filePath
    })

    if (result && result.success) {
      console.log('M3U file updated successfully at', result.path)
      console.log('New name in db:', result.songName)
      setQueueState((prevState) => ({
        ...prevState,
        currentQueue: [...prevState.currentQueue, newTrack]
      }))
      toast.success(`Agregada: ${result.songName}`, {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })
    }
  }

  const addhistory = (common) => ElectronSetter('add-history', common)

  const handleSongClick = (file, index, list, name) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueueState({ currentQueue: list, originalQueue: list, queueName: name })
  }



  const [color, setColor] = useState(() => {
    return localStorage.getItem('colorManual') || ''
  })

  const [backgroundImageUrl, setBackgroundImageUrl] = useState(() => {
    return localStorage.getItem('backgroundImageUrl') || ''
  })

  const currentCoverUrl = useCoverUrl(currentFile?.filePath, 'full')
  const previousCoverUrl = useRef('')

  useEffect(() => {
    if (color) {
      document.documentElement.style.setProperty('--text-principal', color)
      localStorage.setItem('colorManual', color)
      return
    }

    localStorage.removeItem('colorManual')

    if (currentCoverUrl && currentCoverUrl !== previousCoverUrl.current && !currentCoverUrl.includes('svg')) {
      let alive = true
      previousCoverUrl.current = currentCoverUrl
      extractDominantColor(currentCoverUrl)
        .then((dominantColor) => {
          if (alive) {
            document.documentElement.style.setProperty('--text-principal', dominantColor.hex)
          }
        })
        .catch((error) => {
          console.error('Error extracting dominant cover color:', error)
        })

      return () => {
        alive = false
      }
    }
  }, [color, currentCoverUrl])

  const handleColorChange = (value) => {
    // Validar si el valor es un color hexadecimal válido
    const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/

    // Solo actualizar el estado si el valor es un color hex válido o vacío
    if (hexColorRegex.test(value) || value === '') {
      setColor(value)
    }
  }

  const handleBackgroundImageUrlChange = (value) => {
    setBackgroundImageUrl(value)
    localStorage.setItem('backgroundImageUrl', value)
  }

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
  const contextValue = useMemo(() => ({
    mediaRef, // player
    currentFile, //player
    currentIndex, //player
    isShuffled, //player
    muted, //player
    volume,
    setVolume,
    setMediaVolume,
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
    handleGetBPMClick, // utils
    queueState, //lista en reproduccion
    handleSaveClick, // guarda la cola actual en la bd.
    handleQueueAndPlay,
    PlayQueue,
    removeTrack,
    addSong,
    handleTimelineClick,
    progress,
    duration,
    scrollRef,
    isAtEnd,
    getImage,
    handleColorChange,
    color,
    isAwaken,
    handleAwaken,
    toggleStep,
    isStep,
    handleBackgroundImageUrlChange,
    backgroundImageUrl,
    waveformVariant,
    handleWaveformVariantChange
  }), [
    currentFile, currentIndex, isShuffled, muted, volume, isPlaying, loop,
    queueState, progress, duration, isAtEnd, color, isAwaken, isStep,
    backgroundImageUrl, waveformVariant
  ])

  return (
    <SuperContext.Provider value={contextValue}>
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
