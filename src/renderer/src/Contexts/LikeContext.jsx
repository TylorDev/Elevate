/* eslint-disable react/prop-types */
import { createContext, useState, useContext, useEffect } from 'react'
import { validateLike } from './utilMenu'
import { ElectronGetter, ElectronSetter } from './utils'
import { ToLike } from './utilControls'
import { useSuper } from './SupeContext'
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

  const likesong = (common) => ElectronSetter('like-song', common)
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
    console.log(likeState)
  }

  const unlikesong = (common) => ElectronSetter('unlike-song', common, getLikes)

  const toggleLike = () => {
    ToLike(currentFile, likeState.currentLike, likesong, unlikesong, (newLike) => {
      setLikeState((prevState) => ({ ...prevState, currentLike: newLike }))
    })
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
