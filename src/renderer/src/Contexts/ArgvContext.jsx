import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePlaylists } from './PlaylistsContex'
import { useMini } from './MiniContext'
import { useQueue } from './QueueContext'

const ArgvContext = createContext()

export const ArgvProvider = ({ children }) => {
  const { setCurrentFile, setCurrentIndex, setQueueState, PlayQueue, handleQueueAndPlay } =
    useQueue()
  const { getDirectories } = useMini()
  const { getSavedLists } = usePlaylists()
  const [autoplayRequestId, setAutoplayRequestId] = useState(0)
  const queueRef = useRef(Promise.resolve())
  const playQueueRef = useRef(PlayQueue)
  const handleQueueAndPlayRef = useRef(handleQueueAndPlay)
  const getDirectoriesRef = useRef(getDirectories)
  const getSavedListsRef = useRef(getSavedLists)
  const processedDroppedPlaylistImportJobsRef = useRef(new Set())

  playQueueRef.current = PlayQueue
  handleQueueAndPlayRef.current = handleQueueAndPlay
  getDirectoriesRef.current = getDirectories
  getSavedListsRef.current = getSavedLists

  const applyPayload = async (payload) => {
    if (!payload) {
      console.info('[argv/renderer] skipping empty payload', payload)
      return
    }

    console.info('[argv/renderer] applying payload', {
      kind: payload.kind,
      songs: payload.songs?.length || 0,
      files: payload.files?.length || 0,
      directories: payload.directories?.length || 0,
      queueName: payload.queueName,
      playlistPath: payload.playlistPath
    })

    if (payload.kind === 'empty') {
      return
    }

    if (payload.kind === 'playlist-import') {
      if (!payload.playlistPath) {
        console.warn('[argv/renderer] playlist-import payload missing playlistPath', payload)
        return
      }

      await getSavedListsRef.current({ force: true })
      await handleQueueAndPlayRef.current(undefined, undefined, payload.playlistPath)
      return
    }

    if (!payload.songs || payload.songs.length === 0) {
      console.info('[argv/renderer] skipping empty songs payload', payload)
      return
    }

    if (payload.hasDirectories) {
      getDirectoriesRef.current({ force: true })
    }

    if (payload.kind === 'single-file') {
      const song = payload.songs[0]
      setCurrentFile(song)
      setQueueState({
        currentQueue: [song],
        originalQueue: [song],
        queueName: payload.queueName || song.filePath
      })
      setCurrentIndex(payload.startIndex || 0)
      return
    }

    playQueueRef.current(payload.songs, payload.queueName || 'Argv Queue', payload.startIndex || 0)
  }

  const enqueuePayload = (payload) => {
    console.info('[argv/renderer] enqueue payload', {
      kind: payload?.kind,
      songs: payload?.songs?.length || 0,
      queueName: payload?.queueName
    })

    queueRef.current = queueRef.current
      .then(async () => {
        await applyPayload(payload)
        if (payload?.kind === 'playlist-import' || payload?.songs?.length > 0) {
          setAutoplayRequestId((current) => current + 1)
        }
      })
      .catch((error) => {
        console.error('Error applying launch payload:', error)
      })
  }

  const handleExternalPayload = async (payload) => {
    enqueuePayload(payload)
  }

  useEffect(() => {
    let alive = true

    const callback = (data) => {
      enqueuePayload(data)
    }

    const handleDroppedPlaylistImportCompleted = (payload) => {
      const jobId = payload?.jobId

      if (jobId && processedDroppedPlaylistImportJobsRef.current.has(jobId)) {
        return
      }

      if (jobId) {
        processedDroppedPlaylistImportJobsRef.current.add(jobId)
      }

      if (!payload?.success || !payload?.playlistPath) {
        return
      }

      enqueuePayload({
        kind: 'playlist-import',
        files: [],
        directories: [],
        songs: [],
        hasDirectories: false,
        queueName: payload.playlistName || payload.playlistPath,
        startIndex: 0,
        playlistPath: payload.playlistPath,
        playlistName: payload.playlistName
      })
    }

    window.electron.ipcRenderer.on('argv-files-processed', callback)
    window.electron.ipcRenderer.on(
      'dropped-playlist-import-completed',
      handleDroppedPlaylistImportCompleted
    )

    window.electron.ipcRenderer.invoke('get-argv-files')
      .then((payloads) => {
        if (!alive) {
          return
        }

        const normalizedPayloads = Array.isArray(payloads) ? payloads : []
        console.info('[argv/renderer] initial payloads', normalizedPayloads.map((payload) => ({
          kind: payload?.kind,
          songs: payload?.songs?.length || 0,
          queueName: payload?.queueName
        })))
        normalizedPayloads.forEach((payload) => {
          enqueuePayload(payload)
        })
      })
      .catch((error) => {
        console.error('Error reading launch payloads:', error)
      })

    return () => {
      alive = false
      window.electron.ipcRenderer.removeAllListeners('argv-files-processed')
      window.electron.ipcRenderer.removeAllListeners('dropped-playlist-import-completed')
    }
  }, [setCurrentFile, setCurrentIndex, setQueueState])

  return (
    <ArgvContext.Provider value={{ autoplayRequestId, handleExternalPayload }}>
      {children}
    </ArgvContext.Provider>
  )
}

export const useArgv = () => useContext(ArgvContext)
