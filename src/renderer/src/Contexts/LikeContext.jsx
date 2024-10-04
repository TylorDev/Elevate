/* eslint-disable react/prop-types */
import { createContext, useState, useContext, useEffect } from 'react'
import { validateLike } from './utilMenu'
import { ElectronGetter, ElectronSetter } from './utils'
import { ToLike } from './utilControls'
import { useSuper } from './SupeContext'
import { toast } from 'react-toastify'
const ContextLikes = createContext()

export const useLikes = () => useContext(ContextLikes)

export const LikesProvider = ({ children }) => {
  const { currentFile, currentIndex } = useSuper()
  const [likeState, setLikeState] = useState({
    currentLike: false,
    likes: {}
  })

  const isSongLiked = async (filePath, fileName) => {
    await validateLike(filePath, fileName, (isLiked) => {
      setLikeState((prevState) => ({ ...prevState, currentLike: isLiked }))
    })
  }

  const isLiked = async (filePath, fileName, setState) => {
    await validateLike(filePath, fileName, (isLiked) => {
      setState(isLiked)
    })
  }

  const likesong = async (common) => {
    const res = await window.electron.ipcRenderer.invoke('like-song', common)
    toast.success('liked', {
      position: 'bottom-right',
      autoClose: 1000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark'
    })
    return res
  }

  const unlikesong = async (common) => {
    const res = await window.electron.ipcRenderer.invoke('unlike-song', common)
    toast.warning('disliked', {
      position: 'bottom-right',
      autoClose: 1000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark'
    })
    return res
  }

  const getLikes = async () => {
    await ElectronGetter(
      'get-likes',
      (data) => {
        setLikeState((prevState) => ({
          ...prevState,
          likes: data
        }))
      },
      null,
      'Se obtuvieron los likes!'
    )
  }

  const toggleLike = async (file, isLiked) => {
    const fileToUse = file ?? currentFile // Usa currentFile si file es null o undefined

    if (fileToUse && fileToUse.filePath && fileToUse.fileName) {
      // Usa likeState.currentLike si isLiked es undefined
      const currentLike = isLiked !== undefined ? isLiked : likeState.currentLike

      const response = currentLike ? await unlikesong(fileToUse) : await likesong(fileToUse)
      console.log(currentLike ? 'dislike:' : 'like:', response)
      setLikeState((prevState) => ({ ...prevState, currentLike: !currentLike }))
    } else {
      console.error('currentFile is undefined or missing required properties.')
    }

    getLikes()
  }

  useEffect(() => {
    if (currentFile) {
      isSongLiked(currentFile.filePath, currentFile.fileName)
    }
  }, [currentFile?.filePath, currentIndex])

  return (
    <ContextLikes.Provider
      value={{
        likeState,
        likes: likeState.likes,
        isSongLiked,
        likesong,
        unlikesong,
        toggleLike,
        getLikes,
        isLiked
      }}
    >
      {children}
    </ContextLikes.Provider>
  )
}
