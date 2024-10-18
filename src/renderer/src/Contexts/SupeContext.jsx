import { createContext, useContext, useRef, useEffect, useState } from 'react'
import { dataToImageUrl, electronInvoke, ElectronSetter, WindowsPlayer } from './utils'
import { goToNext, goToPrevious, toPlay, toMute, toRepeat, toShuffle } from './utilControls'
import { useNavigate } from 'react-router-dom'
import { Bounce, toast } from 'react-toastify'

// Crear el contexto
const SuperContext = createContext()

// Proveedor del contexto
export const SuperProvider = ({ children }) => {
  const mediaRef = useRef(null)
  const scrollRef = useRef(null)
  const [isShuffled, setIsShuffled] = useState(false) // 1 ref check
  const [muted, setMuted] = useState(false) // 1 ref  check
  const [loop, setLoop] = useState(false) //  1 ref check
  const [isPlaying, setIsPlaying] = useState(false) //1 ref check
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentFile, setCurrentFile] = useState('') // 3 ref - 5 ref
  const [currentIndex, setCurrentIndex] = useState(0) //  4 ref  - 3 ref
  const [queueState, setQueueState] = useState({
    currentQueue: [],
    originalQueue: [],
    queueName: ''
  })

  const [isAwaken, setIsAwaken] = useState(false)

  const [images, setImages] = useState([])

  const handleAwaken = (value) => {
    setIsAwaken(value)
  }
  const getImage = (name, data) => {
    // Verificar si la imagen ya existe
    const existingImage = images.find((image) => image.name === name)

    if (existingImage) {
      // Logear el nombre y la URL existente
      // console.log(
      //   `La imagen con el nombre "${name}" ya existe. URL generada anteriormente: ${existingImage.url}`
      // )
      return existingImage.url
    }

    // Generar la nueva URL
    const url = dataToImageUrl(data)

    // Actualizar el estado con la nueva imagen
    setImages((prevImages) => [...prevImages, { name, url }])

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

  const navigateToResume = (route) => {
    // console.error(`La ruta "${route}" no es válida.`)
    navigate(`/${route}/resume`)
  }

  const handleQueueAndPlay = async (song = undefined, index = undefined, filePath) => {
    const invalidRoutes = ['favourites', 'listen-later', 'tracks', 'stats']

    if (invalidRoutes.includes(filePath)) {
      console.log(`La ruta ${filePath} es inválida`)
      navigateToResume(filePath)
      setCurrentFile(song)
      setCurrentIndex(index)
      return
    }
    if (filePath.startsWith('folder:')) {
      const newFilePath = filePath.replace(/^folder:/, '') // Quita 'folder:' solo al inicio
      navigate(`/directories/${newFilePath}/false?song=${song.filePath}`)
      setCurrentFile(song)
      setCurrentIndex(index)
      const newQueue = await window.electron.ipcRenderer.invoke(
        'get-audio-in-directory',
        newFilePath
      )
      if (newQueue) {
        console.log(newQueue.toString(), 'folder', newFilePath)
        setQueueState((prevState) => ({
          queueName: filePath,
          currentQueue: newQueue,
          originalQueue: newQueue
        }))
      }
      return
    }

    try {
      // console.log('handleQueueAndPlay[Valida]: ', filePath)
      const newQueue = await window.electron.ipcRenderer.invoke('get-list', filePath)

      if (newQueue) {
        const processedQueue = newQueue.processedData
        setQueueState((prevState) => ({
          queueName: filePath,
          currentQueue: processedQueue,
          originalQueue: processedQueue
        }))

        navigate(`/playlists/${filePath}`)

        if (processedQueue && processedQueue.length > 0) {
          setCurrentFile(song || processedQueue[0])
          setCurrentIndex(index || 0)
        } else {
          console.error('Processed queue is empty')
        }
      } else {
        console.log('No files were selected')
      }
    } catch (error) {
      console.error('Error handling queue or file infos:', error)
    }
  }

  const fetchLastData = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('get-last-data')
      if (fileInfos) {
        setCurrentFile(fileInfos.song)
        await handleQueueAndPlay(fileInfos.song, fileInfos.index, fileInfos.queueId)
      }
    } catch (error) {
      console.error('Error fetching last data:', error)
    }
  }

  const getLastData = async () => {
    try {
      const fileInfos = await window.electron.ipcRenderer.invoke('get-last-data')
      if (fileInfos) {
        return fileInfos
      }
    } catch (error) {
      console.error('Error fetching last data:', error)
    }
  }

  const saveLastData = async (file, index, queueId) => {
    // console.log('Nombre en SaveLastData: ' + (queueId || '[sin nombre]'))
    try {
      await window.electron.ipcRenderer.invoke('save-last-data', file, index, queueId)
    } catch (error) {
      console.error('Error saving last data:', error)
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
  }, [currentFile?.filePath, currentIndex])

  useEffect(() => {
    WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick)
  }, [currentFile])

  useEffect(() => {
    if (currentFile && currentIndex !== null) {
      saveLastData(currentFile.filePath, currentIndex, queueState.queueName)
    }
  }, [currentIndex, currentFile, queueState.queueName])

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
    toPlay(mediaRef, isPlaying)
  }
  const toggleMute = () => {
    toMute(mediaRef, muted, setMuted)
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
    // Enviar los paths actualizados al proceso principal
    const result = await electronInvoke('add-new-song', {
      filePath: playlistPath,
      song: newTrack.filePath
    })

    // Manejar el resultado de la operación
    if (result && result.success) {
      console.log('M3U file updated successfully at', result.path)
      console.log('New name in db:', result.nombre)
      // Actualizar el estado con la nueva lista de paths
      setQueueState((prevState) => ({
        ...prevState,
        currentQueue: [...prevState.currentQueue, newTrack]
      }))
    }
  }

  const addhistory = (common) => ElectronSetter('add-history', common)

  const handleSongClick = (file, index, list, name) => {
    setCurrentFile(file)
    setCurrentIndex(index)
    setQueueState({ currentQueue: list, originalQueue: list, queueName: name })

    saveLastData(file.filePath, index, name)
    // console.log('Nombre en ClickSong: ' + (name || '[sin nombre]'))
  }

  const handleResume = (list, name = '') => {
    setQueueState((prevState) => ({
      queueName: name,
      currentQueue: list,
      originalQueue: list
    }))
  }

  const [color, setColor] = useState(() => {
    return localStorage.getItem('color') || '#baff00'
  })

  useEffect(() => {
    // Aplicar el color cuando cambie
    document.documentElement.style.setProperty('--text-principal', color)
    // Guardar el color en localStorage
    localStorage.setItem('color', color)
  }, [color])

  const handleColorChange = (value) => {
    // Validar si el valor es un color hexadecimal válido
    const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/

    // Solo actualizar el estado si el valor es un color hex válido o vacío
    if (hexColorRegex.test(value) || value === '') {
      setColor(value)
    }
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
  return (
    <SuperContext.Provider
      value={{
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
        handleGetBPMClick, // utils
        queueState, //lista en reproduccion
        handleSaveClick, // guarda la cola actual en la bd.
        handleResume,
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
        fetchLastData,
        handleColorChange,
        color,
        isAwaken,
        handleAwaken,
        getLastData,
        toggleStep,
        isStep
      }}
    >
      {children}
    </SuperContext.Provider>
  )
}

// Hook personalizado para acceder al contexto
export const useSuper = () => useContext(SuperContext)
