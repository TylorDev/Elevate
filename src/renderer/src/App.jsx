import './App.scss'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Main from './Layouts/Main/Main'
import { useArgv } from './Contexts/ArgvContext'

// Lazy-loaded pages — each page loads as a separate chunk on demand
const Feed = lazy(() => import('./Pages/Feed/Feed'))
const Favourites = lazy(() => import('./Pages/Favourites/Favourites'))
const ListenLater = lazy(() => import('./Pages/ListenLater/ListenLater'))
const AllTracks = lazy(() => import('./Pages/AllTracks/AllTracks'))
const History = lazy(() => import('./Pages/History/History'))
const Playlists = lazy(() => import('./Pages/Playlists/Playlists'))
const Directories = lazy(() => import('./Pages/Directories/Directories'))
const Music = lazy(() => import('./Pages/Music/Music'))
const PlaylistPage = lazy(() => import('./Pages/PlaylistPage/PlaylistPage'))
const DirPage = lazy(() => import('./Pages/DirPage/DirPage'))
const Settings = lazy(() => import('./Components/Settings/Settings'))
const Lista = lazy(() => import('./Pages/Lista/Lista'))

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader__spinner" />
    </div>
  )
}

function App() {
  const { handleExternalPayload } = useArgv()

  useEffect(() => {
    const getPathForFile = (file) => {
      if (!file) {
        return ''
      }

      return window.electron?.webUtils?.getPathForFile?.(file) || ''
    }

    const handleDragOver = (event) => {
      event.preventDefault()
    }

    const handleDrop = (event) => {
      event.preventDefault()

      const files = Array.from(event.dataTransfer?.files || [])
      const fallbackFilePaths = files
        .map((file) => getPathForFile(file))
        .filter(Boolean)

      const items = Array.from(event.dataTransfer?.items || [])
      const itemEntries = items
        .map((item) => ({
          item,
          entry: item?.webkitGetAsEntry?.() || null
        }))
        .filter(({ entry }) => Boolean(entry))

      const droppedDirectories = itemEntries
        .filter(({ entry }) => entry.isDirectory)
        .map(({ item, entry }) => {
          const asFilePath = getPathForFile(item?.getAsFile?.())
          return asFilePath || entry.fullPath || entry.name
        })
        .filter(Boolean)

      const droppedFilePathsFromEntries = itemEntries
        .filter(({ entry }) => entry.isFile)
        .map(({ item }) => getPathForFile(item?.getAsFile?.()))
        .filter(Boolean)

      const uniqueFilePaths = [...new Set(
        itemEntries.length > 0
          ? droppedFilePathsFromEntries
          : fallbackFilePaths
      )]
      const uniqueDirectoryPaths = [...new Set(droppedDirectories)]
      const hasDirectories = uniqueDirectoryPaths.length > 0
      const hasMultipleFiles = uniqueFilePaths.length > 1
      const hasSingleFileOnly = uniqueFilePaths.length === 1 && !hasDirectories

      console.info('[drop] raw transfer', {
        fileCount: files.length,
        itemCount: items.length,
        fallbackFilePaths,
        droppedFilePathsFromEntries,
        droppedDirectories: uniqueDirectoryPaths
      })

      if (hasSingleFileOnly) {
        console.info('[drop] single file:', uniqueFilePaths[0])
      }

      if (hasMultipleFiles) {
        console.info('[drop] files:', uniqueFilePaths)
      }

      if (uniqueDirectoryPaths.length === 1) {
        console.info('[drop] directory:', uniqueDirectoryPaths[0])
      } else if (uniqueDirectoryPaths.length > 1) {
        console.info('[drop] directories:', uniqueDirectoryPaths)
      }

      const droppedPaths = [...uniqueFilePaths, ...uniqueDirectoryPaths]
      if (droppedPaths.length > 0) {
        void window.electron.ipcRenderer
          .invoke('process-dropped-paths', droppedPaths)
          .then((payload) => {
            console.info('[drop] playback payload:', {
              kind: payload?.kind,
              files: payload?.files?.length || 0,
              directories: payload?.directories?.length || 0,
              songs: payload?.songs?.length || 0,
              queueName: payload?.queueName
            })

            return handleExternalPayload(payload)
          })
          .catch((error) => {
            console.error('Error processing dropped paths:', error)
          })
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleExternalPayload])

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Main />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Feed /></Suspense>} />
          <Route path="/playlists" element={<Suspense fallback={<PageLoader />}><Playlists /></Suspense>} />
          <Route path="/playlists/:dir" element={<Suspense fallback={<PageLoader />}><PlaylistPage /></Suspense>} />
          <Route path="/favourites/:dir" element={<Suspense fallback={<PageLoader />}><Favourites /></Suspense>} />
          <Route path="/favourites/" element={<Suspense fallback={<PageLoader />}><Favourites /></Suspense>} />
          <Route path="/listen-later/:dir" element={<Suspense fallback={<PageLoader />}><ListenLater /></Suspense>} />
          <Route path="/listen-later/" element={<Suspense fallback={<PageLoader />}><ListenLater /></Suspense>} />
          <Route path="/history" element={<Suspense fallback={<PageLoader />}><History /></Suspense>} />
          <Route path="/tracks/:dir" element={<Suspense fallback={<PageLoader />}><AllTracks /></Suspense>} />
          <Route path="/tracks/" element={<Suspense fallback={<PageLoader />}><AllTracks /></Suspense>} />
          <Route path="/search" element={<Navigate to="/" replace />} />
          <Route path="/directories" element={<Suspense fallback={<PageLoader />}><Directories /></Suspense>} />
          <Route path="/directories/:directory/:play" element={<Suspense fallback={<PageLoader />}><DirPage /></Suspense>} />
          <Route path="/music" element={<Suspense fallback={<PageLoader />}><Music /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="/list" element={<Suspense fallback={<PageLoader />}><Lista /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </div>
  )
}

function NotFound() {
  return <div className="Not">ERROR 404 sorry</div>
}

export default App
