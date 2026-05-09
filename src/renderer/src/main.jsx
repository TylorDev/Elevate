import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import { SuperProvider } from './Contexts/SupeContext'
import { MiniProvider } from './Contexts/MiniContext'
import { LikesProvider } from './Contexts/LikeContext'
import { AudioProvider } from './Contexts/AudioContext'
import { PlaylistsProvider } from './Contexts/PlaylistsContex'
import { SessionProvider } from './Contexts/SessionContext'
import { ArgvProvider } from './Contexts/ArgvContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <SessionProvider>
        <SuperProvider>
          <AppProvider>
            <MiniProvider>
              <ArgvProvider>
                <PlaylistsProvider>
                  <LikesProvider>
                    <AudioProvider>
                      <App />
                    </AudioProvider>
                  </LikesProvider>
                </PlaylistsProvider>
              </ArgvProvider>
            </MiniProvider>
          </AppProvider>
        </SuperProvider>
      </SessionProvider>
    </HashRouter>
  </React.StrictMode>
)
