import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import { SuperProvider } from './Contexts/SupeContext'
import { PlaybackProvider } from './Contexts/PlaybackContext'
import { PlaybackProgressProvider } from './Contexts/PlaybackProgressContext'
import { QueueProvider } from './Contexts/QueueContext'
import { BackgroundProvider } from './Contexts/BackgroundContext'
import { MiniProvider } from './Contexts/MiniContext'
import { LikesProvider } from './Contexts/LikeContext'
import { AudioProvider } from './Contexts/AudioContext'
import { PlaylistsProvider } from './Contexts/PlaylistsContex'
import { ArgvProvider } from './Contexts/ArgvContext'
import { GlobalSearchProvider } from './Contexts/GlobalSearchContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <QueueProvider>
        <PlaybackProvider>
          <PlaybackProgressProvider>
            <BackgroundProvider>
              <SuperProvider>
                <AppProvider>
                  <MiniProvider>
                    <PlaylistsProvider>
                      <ArgvProvider>
                        <GlobalSearchProvider>
                          <LikesProvider>
                            <AudioProvider>
                              <App />
                            </AudioProvider>
                          </LikesProvider>
                        </GlobalSearchProvider>
                      </ArgvProvider>
                    </PlaylistsProvider>
                  </MiniProvider>
                </AppProvider>
              </SuperProvider>
            </BackgroundProvider>
          </PlaybackProgressProvider>
        </PlaybackProvider>
      </QueueProvider>
    </HashRouter>
  </React.StrictMode>
)
