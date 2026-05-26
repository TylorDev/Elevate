import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { SuperProvider } from './Contexts/SupeContext'
import { PlaybackProvider } from './Contexts/PlaybackContext'
import { PlaybackProgressProvider } from './Contexts/PlaybackProgressContext'
import { QueueProvider } from './Contexts/QueueContext'
import { BackgroundProvider } from './Contexts/BackgroundContext'
import { ImagesProvider } from './Contexts/ImagesContext'
import { MiniProvider } from './Contexts/MiniContext'
import { LikesProvider } from './Contexts/LikeContext'
import { AudioProvider } from './Contexts/AudioContext'
import { PlaylistsProvider } from './Contexts/PlaylistsContex'
import { ArgvProvider } from './Contexts/ArgvContext'
import { GlobalSearchProvider } from './Contexts/GlobalSearchContext'
import { I18nProvider } from './Contexts/I18nContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <I18nProvider>
        <QueueProvider>
          <PlaybackProvider>
            <PlaybackProgressProvider>
              <BackgroundProvider>
                <ImagesProvider>
                  <SuperProvider>
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
                  </SuperProvider>
                </ImagesProvider>
              </BackgroundProvider>
            </PlaybackProgressProvider>
          </PlaybackProvider>
        </QueueProvider>
      </I18nProvider>
    </HashRouter>
  </React.StrictMode>
)
