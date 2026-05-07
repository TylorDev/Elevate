import './Header.scss'
import { NavLink } from 'react-router-dom'
import {
  LuAudioWaveform,
  LuChartColumnIncreasing,
  LuCalendarDays,
  LuSettings
} from 'react-icons/lu'
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
            <LuAudioWaveform /> <span className="Link-name">Feed </span>
          </NavLink>

          <NavLink to="/search" className={getActiveClass}>
            <LuChartColumnIncreasing /> <span className="Link-name">Stats </span>
          </NavLink>

          <NavLink to="/history" className={getActiveClass}>
            <LuCalendarDays /> <span className="Link-name">History </span>
          </NavLink>

          <NavLink to="/settings" className={getActiveClass}>
            <LuSettings /> <span className="Link-name">Settings </span>
          </NavLink>
        </div>
      </div>
    </div>
  )
}

export default Header
