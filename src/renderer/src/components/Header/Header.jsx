import './Header.scss'
import { NavLink } from 'react-router-dom'
import { PiWaveform } from 'react-icons/pi'
import { MdBarChart } from 'react-icons/md'
import { IoCalendarOutline } from 'react-icons/io5'
import { BsGear } from 'react-icons/bs'
import { useSuper } from '../../Contexts/SupeContext'

function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')
  const { handleAwaken } = useSuper()

  return (
    <div className="navbar" id="Header">
      <div className="nav-sec">
        <div className="sec-i">
          <NavLink
            to="/"
            className={getActiveClass}
            onClick={() => {
              handleAwaken(true)
            }}
          >
            <PiWaveform /> <span className="Link-name">Feed </span>
          </NavLink>

          <NavLink to="/search" className={getActiveClass}>
            <MdBarChart /> <span className="Link-name">Stats </span>
          </NavLink>

          <NavLink to="/history" className={getActiveClass}>
            <IoCalendarOutline /> <span className="Link-name">History </span>
          </NavLink>

          <NavLink to="/settings" className={getActiveClass}>
            <BsGear /> <span className="Link-name">Settings </span>
          </NavLink>
        </div>
      </div>
    </div>
  )
}

export default Header

