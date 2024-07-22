import Header from '../../Components/Header/Header'
import './Main.scss'
import { Outlet } from 'react-router-dom'
import { AudioPlayer } from './../../AudioPlayer'
function Main() {
  return (
    <div className="Main">
      <Header />
      <Outlet />
    </div>
  )
}
export default Main
