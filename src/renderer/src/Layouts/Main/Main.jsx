import { Bounce, ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import './Main.scss'
import { Outlet } from 'react-router-dom'

function Main() {
  return (
    <div className="Main">
      <Header />
      <div className="outlet">
        <Outlet />
      </div>

      <AudioPlayer />

      <ToastContainer />
    </div>
  )
}
export default Main
