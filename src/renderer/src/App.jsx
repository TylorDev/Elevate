import './App.scss'
import { Route, Routes } from 'react-router-dom'
import Main from './Layouts/Main/Main'
import Favourites from './Pages/Favourites/Favourites'
import ListenLater from './Pages/ListenLater/ListenLater'
import AllTracks from './Pages/AllTracks/AllTracks'
import History from './Pages/History/History'
import Playlists from './Pages/Playlists/Playlists'
import Directories from './Pages/Directories/Directories'
import Feed from './Pages/Feed/Feed'
import Music from './Pages/Music/Music'
import Search from './Pages/Search/Search'
import { MiniProvider } from './Contexts/MiniContext'
import { LikesProvider } from './Contexts/LikeContext'
import { AudioProvider } from './Contexts/AudioContext'
import { PlaylistsProvider } from './Contexts/PlaylistsContex'
import { useSuper } from './Contexts/SupeContext'
import PlaylistPage from './Pages/PlaylistPage/PlaylistPage'
import DirPage from './Pages/DirPage/DirPage'
import Lista from './Pages/Lista/Lista'

import SearchBar from './Components/SearchBar/SearchBar'

function App() {
  return (
    <MiniProvider>
      <PlaylistsProvider>
        <LikesProvider>
          <AudioProvider>
            <div className="App">
              <div className="Tittlebar">Taylord</div>
              <SearchBar />

              <Routes>
                <Route path="/" element={<Main />}>
                  <Route index element={<Feed />} />
                  <Route path="/playlists" element={<Playlists />} />
                  <Route path="/playlists/:dir" element={<PlaylistPage />} />
                  <Route path="/favourites/:dir" element={<Favourites />} />
                  <Route path="/favourites/" element={<Favourites />} />
                  <Route path="/listen-later/:dir" element={<ListenLater />} />
                  <Route path="/listen-later/" element={<ListenLater />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/tracks/:dir" element={<AllTracks />} />
                  <Route path="/tracks/" element={<AllTracks />} />
                  <Route path="/list" element={<Lista />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/directories" element={<Directories />} />
                  <Route path="/directories/:directory/:play" element={<DirPage />} />
                  <Route path="/music" element={<Music />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </div>
          </AudioProvider>
        </LikesProvider>
      </PlaylistsProvider>
    </MiniProvider>
  )
}

// function AudioProvider() {
//   const { currentFile, handleNextClick, mediaRef } = useSuper()

//   return (
//     <audio ref={mediaRef} controls autoPlay onEnded={handleNextClick} style={{ display: 'none' }}>
//       {currentFile && currentFile.filePath ? (
//         <source src={currentFile.filePath} type="audio/mpeg" />
//       ) : (
//         <p>Tu navegador no soporta el elemento de audio.</p>
//       )}
//     </audio>
//   )
// }

function NotFound() {
  return <div className="Not">ERROR 404 sorry</div>
}

export default App
