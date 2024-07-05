import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import FileSelector from './FileSelector'

function App() {
  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <Versions></Versions>
      <FileSelector />
    </>
  )
}

export default App
