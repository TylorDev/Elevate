import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'
import { SuperProvider } from './Contexts/SupeContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <SuperProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </SuperProvider>
    </HashRouter>
  </React.StrictMode>
)
