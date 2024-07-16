import FileSelector from './FileSelector'
import './App.scss'

import { AppProvider } from './Contexts/AppContext'

function App() {
  return (
    <AppProvider>
      <div className="App">
        <FileSelector />
      </div>
    </AppProvider>
  )
}

export default App
