import FileSelector from './FileSelector'
import './App.scss'
import { Route, Routes } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import Main from './Layouts/Main/Main'
import { PlaylistActions } from './PlaylistActions'

function App() {
  return (
    <AppProvider>
      <div className="App">
        <Routes>
          <Route path="/" element={<Main />}>
            <Route index element={<FileSelector />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/playlists" element={<PlaylistActions />} />
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
