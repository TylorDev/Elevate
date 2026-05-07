import './App.scss'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Main from './Layouts/Main/Main'

// Lazy-loaded pages — each page loads as a separate chunk on demand
const Feed = lazy(() => import('./Pages/Feed/Feed'))
const Favourites = lazy(() => import('./Pages/Favourites/Favourites'))
const ListenLater = lazy(() => import('./Pages/ListenLater/ListenLater'))
const AllTracks = lazy(() => import('./Pages/AllTracks/AllTracks'))
const History = lazy(() => import('./Pages/History/History'))
const Playlists = lazy(() => import('./Pages/Playlists/Playlists'))
const Directories = lazy(() => import('./Pages/Directories/Directories'))
const Music = lazy(() => import('./Pages/Music/Music'))
const Search = lazy(() => import('./Pages/Search/Search'))
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
          <Route path="/search" element={<Suspense fallback={<PageLoader />}><Search /></Suspense>} />
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
