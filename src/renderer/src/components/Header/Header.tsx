import { memo } from 'react'
import './Header.scss'
import { NavLink } from 'react-router-dom'
import {
  LuAudioWaveform,
  LuChartColumnIncreasing,
  LuCalendarDays,
  LuHeart,
  LuSlidersHorizontal
} from 'react-icons/lu'
import { useSuper } from '../../Contexts/SupeContext'

const Header = memo(function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')
  const { handleAwaken } = useSuper()

  return (
    <div className="navbar" id="Header">
      <div className="nav-sec">
        <div className="sec-i">
          <NavLink
            to="/feed"
            className={getActiveClass}
            title="Feed"
            onClick={() => {
              handleAwaken(true)
            }}
          >
            <LuAudioWaveform />
          </NavLink>

          <NavLink to="/statistics" className={getActiveClass} title="Stats">
            <LuChartColumnIncreasing />
          </NavLink>

          <NavLink to="/favourites" className={getActiveClass} title="Favorites">
            <LuHeart />
          </NavLink>

          <NavLink to="/settings" className={getActiveClass} title="Settings">
            <LuSlidersHorizontal />
          </NavLink>
          <NavLink to="/history" className={getActiveClass} title="History">
            <LuCalendarDays />
          </NavLink>
        </div>
      </div>
    </div>
  )
})

export default Header
