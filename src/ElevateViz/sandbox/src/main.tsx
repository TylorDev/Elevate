import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './styles/global.scss'
import { Sandbox } from './pages/Sandbox/Sandbox'

const root = document.getElementById('root')

if (!root) throw new Error('Sandbox root element not found')

createRoot(root).render(
  <>
    <Sandbox />
    <ToastContainer position="bottom-right" theme="dark" />
  </>
)
