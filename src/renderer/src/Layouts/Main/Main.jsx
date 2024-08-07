import Header from '../../Components/Header/Header'
import './Main.scss'
import { Outlet } from 'react-router-dom'
import { AudioPlayer } from './../../AudioPlayer'

function Main() {
  return (
    <div className="Main">
      <Header />
      <div className="outlet">
        <Outlet />
      </div>

      <AudioPlayer />
    </div>
  )
}
export default Main
