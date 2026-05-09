import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useSuper } from './SupeContext'
import { validateLike } from './utilMenu'
import { ElectronGetter } from './utils'

const ContextLikes = createContext()

function buildLikesLookup(likes) {
  const fileInfos = likes?.fileInfos

  if (!Array.isArray(fileInfos)) {
    return new Map()
  }

  return new Map(fileInfos.map((file) => [file.filePath, true]))
}

function updateLikesCollection(previousLikes, file, nextLiked) {
  if (!previousLikes || typeof previousLikes !== 'object') {
    return previousLikes
  }

  const fileInfos = Array.isArray(previousLikes.fileInfos) ? previousLikes.fileInfos : null

  if (!fileInfos) {
    return previousLikes
  }

  const alreadyExists = fileInfos.some((item) => item.filePath === file.filePath)
  let nextFileInfos = fileInfos

  if (nextLiked && !alreadyExists) {
    nextFileInfos = [file, ...fileInfos]
  } else if (!nextLiked && alreadyExists) {
    nextFileInfos = fileInfos.filter((item) => item.filePath !== file.filePath)
  }

  if (nextFileInfos === fileInfos) {
    return previousLikes
  }

  const previousDuration = Number(previousLikes.totalDuration) || 0
  const songDuration = Number(file.duration) || 0
  const nextTotalDuration = nextLiked
    ? previousDuration + (alreadyExists ? 0 : songDuration)
    : Math.max(previousDuration - (alreadyExists ? songDuration : 0), 0)

  return {
    ...previousLikes,
    fileInfos: nextFileInfos,
    totalDuration: nextTotalDuration
  }
}

export const useLikes = () => useContext(ContextLikes)

export const LikesProvider = ({ children }) => {
  const { currentFile, currentIndex } = useSuper()
  const [likeState, setLikeState] = useState({
    currentLike: false,
    likes: {}
  })
  const [likesLookup, setLikesLookup] = useState(() => new Map())

  const syncLikesPayload = useCallback((likes) => {
    setLikeState((prevState) => ({
      ...prevState,
      likes
    }))
    setLikesLookup(buildLikesLookup(likes))
  }, [])

  const isSongLiked = useCallback(async (filePath, fileName) => {
    await validateLike(filePath, fileName, (isLiked) => {
      setLikeState((prevState) => ({ ...prevState, currentLike: isLiked }))
    })
  }, [])

  const isLiked = useCallback(async (filePath, fileName, setState) => {
    await validateLike(filePath, fileName, (nextIsLiked) => {
      setState(nextIsLiked)
    })
  }, [])

  const likesong = useCallback(async (common) => {
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
  }, [])

  const unlikesong = useCallback(async (common) => {
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
  }, [])

  const getLikes = useCallback(async () => {
    const likes = await ElectronGetter('get-likes', null, null, 'Se obtuvieron los likes!')

    if (likes) {
      syncLikesPayload(likes)
    }

    return likes
  }, [syncLikesPayload])

  const toggleLike = useCallback(
    async (file, isLikedValue, { refreshCollection = false } = {}) => {
      const fileToUse = file ?? currentFile

      if (!fileToUse?.filePath || !fileToUse?.fileName) {
        console.error('currentFile is undefined or missing required properties.')
        return null
      }

      const currentLike = isLikedValue !== undefined ? isLikedValue : likeState.currentLike
      const nextLike = !currentLike

      setLikeState((prevState) => ({
        ...prevState,
        currentLike: nextLike,
        likes: updateLikesCollection(prevState.likes, fileToUse, nextLike)
      }))
      setLikesLookup((prevLookup) => {
        const nextLookup = new Map(prevLookup)

        if (nextLike) {
          nextLookup.set(fileToUse.filePath, true)
        } else {
          nextLookup.delete(fileToUse.filePath)
        }

        return nextLookup
      })

      try {
        const response = currentLike ? await unlikesong(fileToUse) : await likesong(fileToUse)
        console.log(currentLike ? 'dislike:' : 'like:', response)

        if (refreshCollection) {
          await getLikes()
        }

        return response
      } catch (error) {
        setLikeState((prevState) => ({
          ...prevState,
          currentLike,
          likes: updateLikesCollection(prevState.likes, fileToUse, currentLike)
        }))
        setLikesLookup((prevLookup) => {
          const revertedLookup = new Map(prevLookup)

          if (currentLike) {
            revertedLookup.set(fileToUse.filePath, true)
          } else {
            revertedLookup.delete(fileToUse.filePath)
          }

          return revertedLookup
        })

        throw error
      }
    },
    [currentFile, getLikes, likeState.currentLike, likesong, unlikesong]
  )

  useEffect(() => {
    if (currentFile) {
      isSongLiked(currentFile.filePath, currentFile.fileName)
    }
  }, [currentFile?.filePath, currentIndex, isSongLiked])

  const contextValue = useMemo(
    () => ({
      likeState,
      likes: likeState.likes,
      likesLookup,
      isSongLiked,
      likesong,
      unlikesong,
      toggleLike,
      getLikes,
      isLiked
    }),
    [getLikes, isLiked, isSongLiked, likeState, likesLookup, likesong, toggleLike, unlikesong]
  )

  return <ContextLikes.Provider value={contextValue}>{children}</ContextLikes.Provider>
}
