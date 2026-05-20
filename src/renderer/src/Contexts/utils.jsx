import { Bounce, toast } from 'react-toastify'

export const shuffleArray = (array, currentIndex) => {
  // Copia el array original para no modificarlo
  let newArray = [...array]

    // Mueve el elemento actual a la primera posición
    ;[newArray[0], newArray[currentIndex]] = [newArray[currentIndex], newArray[0]]

  // Aplica el algoritmo de Fisher-Yates solo desde el índice 1
  for (let i = newArray.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * i) // solo intercambia desde el índice 1 en adelante
      ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }

  return newArray
}

const pendingInvokes = new Map()

function getInvokeKey(action, args) {
  return `${action}:${JSON.stringify(args)}`
}

export const dedupedInvoke = async (action, ...args) => {
  const key = getInvokeKey(action, args)
  const pendingInvoke = pendingInvokes.get(key)

  if (pendingInvoke) {
    return pendingInvoke
  }

  const invokePromise = window.electron.ipcRenderer.invoke(action, ...args).finally(() => {
    pendingInvokes.delete(key)
  })

  pendingInvokes.set(key, invokePromise)
  return invokePromise
}

export const createLatestOnlyInvoker = () => {
  let latestRequestId = 0

  return async (action, ...args) => {
    const requestId = latestRequestId + 1
    latestRequestId = requestId

    const result = await dedupedInvoke(action, ...args)

    return {
      isLatest: requestId === latestRequestId,
      result
    }
  }
}

export const ElectronGetter = async (action, setState = null, value = null, message = null) => {
  try {
    const fileInfos = await dedupedInvoke(action, value)
    if (fileInfos) {
      setState?.(fileInfos)
      // toast.success(message || 'Completado!', {
      //   position: 'bottom-right',
      //   autoClose: 3000,
      //   hideProgressBar: false,
      //   closeOnClick: true,
      //   pauseOnHover: true,
      //   draggable: true,
      //   progress: undefined,
      //   theme: 'dark',
      //   transition: Bounce
      // })
    } else {
      console.log('No files were selected')
    }

    return fileInfos
  } catch (error) {
    // Mostrar el error del backend
    toast.error(error.message || 'Error desconocido', {
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
    console.error('Error selecting files:', error)
    throw error
  }
}

export const ElectronDelete = async (action, value, message = null) => {
  try {
    const fileInfos = await window.electron.ipcRenderer.invoke(action, value)
    if (fileInfos) {
      toast.warning(message || 'Eliminado!', {
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
    } else {
      console.log('No files were selected')
    }
  } catch (error) {
    // Mostrar el error del backend
    toast.error(error.message || 'Error desconocido', {
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
    console.error('Error selecting files:', error)
  }
}

export const ElectronGetter2 = async (action, setState = null, value = null) => {
  try {
    const fileInfos = await dedupedInvoke(action, value)
    if (fileInfos) {
      setState?.(fileInfos)
    } else {
      console.log('No files were selected')
    }
  } catch (error) {
    toast.error(error, {
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
    console.error('Error selecting files:', error)
  }
}

export const ElectronSetter = async (action, common = undefined, getter = undefined) => {
  const { filePath, fileName } = common

  try {
    const fileInfo = await window.electron.ipcRenderer.invoke(action, filePath, fileName)
    if (getter) {
      getter()
    }
  } catch (error) {
    toast.error(error, {
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
    console.error('Error saving file:', error)
  }
}

export const ElectronSetter2 = async (action, ...values) => {
  console.log(...values)
  try {
    const fileInfo = await window.electron.ipcRenderer.invoke(action, ...values)

    console.log('File info:', fileInfo)

    // Devolver un mensaje de éxito junto con la información del archivo
    return { success: true, message: 'Data sent successfully', fileInfo }
  } catch (error) {
    toast.error(error, {
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

    console.error('Error saving file:', error)

    // Devolver un mensaje de error
    return { success: false, message: 'Error saving file', error }
  }
}

export const electronInvoke = async (action, ...args) => {
  try {
    const result = await window.electron.ipcRenderer.invoke(action, ...args)
    if (result.success !== undefined) {
      if (!result.success) {
        console.error(`Error: ${result.error || 'Unknown error'}`)
      }
    }
    return result
  } catch (error) {
    toast.error(error, {
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
    console.error(`Error during ${action}:`, error)
  }
}

export function WindowsPlayer(mediaRef, currentFile, currentCoverUrl, handlePreviousClick, handleNextClick) {
  const audio = mediaRef.current

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentFile?.title || currentFile?.fileName || 'Unknown',
      artist: currentFile?.artist || 'Unknown',
      album: currentFile?.album || 'Unknown',
      artwork: [
        {
          src: currentCoverUrl || 'https://i.pinimg.com/736x/ef/23/25/ef2325cedb047b8ac24fc2b718c15a30.jpg',
          sizes: '512x512',
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
}
