import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HashRouter } from 'react-router-dom'
import { AppProvider } from './Contexts/AppContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
)
