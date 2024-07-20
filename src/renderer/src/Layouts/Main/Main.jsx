import Header from '../../Components/Header/Header'
import './Main.scss'
import { Outlet } from 'react-router-dom'
function Main() {
  return (
    <div className="Main">
      <Header />
      <Outlet />
    </div>
  )
}
export default Main
