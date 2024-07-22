import FileSelector from './FileSelector'
import './App.scss'
import { Route, Routes } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import Main from './Layouts/Main/Main'
import { PlaylistActions } from './PlaylistActions'
import Favourites from './Pages/Favourites/Favourites'
import { AudioPlayer } from './AudioPlayer'
import MediaPlayer from './Mediaplayer'

function App() {
  return (
    <AppProvider>
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
            <Route path="/playlists" element={<PlaylistActions />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/4" element={<MediaPlayer />} />
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
