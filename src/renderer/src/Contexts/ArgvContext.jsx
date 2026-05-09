import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSuper } from './SupeContext'
import { useMini } from './MiniContext'
import { useSession } from './SessionContext'

const ArgvContext = createContext()

export const ArgvProvider = ({ children }) => {
  const { setCurrentFile, setCurrentIndex, setQueueState } = useSession()
  const { PlayQueue } = useSuper()
  const { getDirectories } = useMini()
  const [launchReady, setLaunchReady] = useState(false)
  const queueRef = useRef(Promise.resolve())

  const applyPayload = async (payload) => {
    if (!payload || !payload.songs || payload.songs.length === 0) {
      console.info('[argv/renderer] skipping empty payload', payload)
      return
    }

    console.info('[argv/renderer] applying payload', {
      kind: payload.kind,
      songs: payload.songs.length,
      files: payload.files?.length || 0,
      directories: payload.directories?.length || 0,
      queueName: payload.queueName
    })

    if (payload.hasDirectories) {
      getDirectories({ force: true })
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

    PlayQueue(payload.songs, payload.queueName || 'Argv Queue', payload.startIndex || 0)
  }

  const enqueuePayload = (payload) => {
    console.info('[argv/renderer] enqueue payload', {
      kind: payload?.kind,
      songs: payload?.songs?.length || 0,
      queueName: payload?.queueName
    })

    queueRef.current = queueRef.current
      .then(() => applyPayload(payload))
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

    window.electron.ipcRenderer.on('argv-files-processed', callback)

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

        queueRef.current.finally(() => {
          if (alive) {
            setLaunchReady(true)
          }
        })
      })
      .catch((error) => {
        console.error('Error reading launch payloads:', error)
        if (alive) {
          setLaunchReady(true)
        }
      })

    return () => {
      alive = false
      window.electron.ipcRenderer.removeAllListeners('argv-files-processed')
    }
  }, [])

  return (
    <ArgvContext.Provider value={{ launchReady, handleExternalPayload }}>
      {children}
    </ArgvContext.Provider>
  )
}

export const useArgv = () => useContext(ArgvContext)
