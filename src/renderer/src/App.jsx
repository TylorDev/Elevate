import './App.scss'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import Main from './Layouts/Main/Main'

import Favourites from './Pages/Favourites/Favourites'
import { AudioPlayer } from './AudioPlayer'
import MediaPlayer from './Mediaplayer'
import ListenLater from './Pages/ListenLater/ListenLater'
import AllTracks from './Pages/AllTracks/AllTracks'
import History from './Pages/History/History'
import Playlists from './Pages/Playlists/Playlists'
import Directories from './Pages/Directories/Directories'
import Feed from './Pages/Feed/Feed'

import Music from './Pages/Music/Music'

function App() {
  return (
    <AppProvider>
      <div className="App">
        <div className="Tittlebar"> xd</div>

        <Routes>
          <Route path="/" element={<Main />}>
            <Route index element={<Feed />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/listen-later" element={<ListenLater />} />
            <Route path="/history" element={<History />} />
            <Route path="/tracks" element={<AllTracks />} />
            <Route path="/2" element={<MediaPlayer />} />
            <Route path="/directories" element={<Directories />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/music" element={<Music />} />
        </Routes>
      </div>
    </AppProvider>
  )
}

function NotFound() {
  return <div className="Not">ERROR 404 sorry</div>
}

export default App
