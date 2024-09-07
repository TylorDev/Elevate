import { Bounce, toast } from 'react-toastify'

export const shuffleArray = (array, currentIndex) => {
  let newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    // Intercambia elementos, evitando que el currentIndex cambie de posición
    if (i !== currentIndex && j !== currentIndex) {
      ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
  }
  return newArray
}

export const uint8ArrayToImageUrl = (uint8Array, mimeType) => {
  // Convertir el Uint8Array a Blob
  const blob = new Blob([uint8Array], { type: mimeType })

  // Crear una URL para el Blob
  const imageUrl = URL.createObjectURL(blob)

  // Devolver la URL
  return imageUrl
}

export const ElectronGetter = async (action, setState = null, filepath = null) => {
  try {
    const fileInfos = await window.electron.ipcRenderer.invoke(action, filepath)
    if (fileInfos) {
      setState(fileInfos)
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

export const ElectronGetter2 = async (action, setState = null, value = null) => {
  try {
    const fileInfos = await window.electron.ipcRenderer.invoke(action, value)
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
  console.log('[ElectronSetterLog]', filePath, fileName)
  try {
    const fileInfo = await window.electron.ipcRenderer.invoke(action, filePath, fileName)
    if (getter) {
      getter()
    }

    console.log('File info:', fileInfo)
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

export const BinToBlob = (img, mimeType = 'image/png') => {
  if (img && img.data && img.type !== 'Other') {
    const blob = new Blob([img.data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    return url
  }
  return 'https://i.pinimg.com/736x/ef/23/25/ef2325cedb047b8ac24fc2b718c15a30.jpg'
}
export function WindowsPlayer(mediaRef, currentFile, handlePreviousClick, handleNextClick) {
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
}
