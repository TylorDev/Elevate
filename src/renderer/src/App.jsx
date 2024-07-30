import FileSelector from './FileSelector'
import './App.scss'
import { Route, Routes } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import Main from './Layouts/Main/Main'
import { PlaylistActions } from './PlaylistActions'
import Favourites from './Pages/Favourites/Favourites'
import { AudioPlayer } from './AudioPlayer'
import MediaPlayer from './Mediaplayer'
import ListenLater from './Pages/ListenLater/ListenLater'
import AllTracks from './Pages/AllTracks/AllTracks'
import History from './Pages/History/History'
import Playlists from './Pages/Playlists/Playlists'
import Directories from './Pages/Directories/Directories'

function App() {
  return (
    <AppProvider>
      <div className="Tittlebar"></div>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <Main />
                <AudioPlayer />
              </div>
            }
          >
            <Route index element={<FileSelector />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/listen-later" element={<ListenLater />} />
            <Route path="/history" element={<History />} />
            <Route path="/tracks" element={<AllTracks />} />
            <Route path="/2" element={<MediaPlayer />} />
            <Route path="/directories" element={<Directories />} />
          </Route>
        </Routes>
      </div>
    </AppProvider>
  )
}

function NotFound() {
  return <div className="Not">ERROR 404 sorry</div>
}

export default App
