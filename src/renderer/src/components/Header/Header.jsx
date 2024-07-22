import './Header.scss'
import { NavLink } from 'react-router-dom'
function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')

  return (
    <div className="navbar">
      <NavLink to="/" className={getActiveClass}>
        Feed
      </NavLink>
      <NavLink to="/playlists" className={getActiveClass}>
        Playlists
      </NavLink>
      <NavLink to="/2" className={getActiveClass}>
        Statistics
      </NavLink>
      <NavLink to="/favourites" className={getActiveClass}>
        Favourites
      </NavLink>
      <NavLink to="/listen-later" className={getActiveClass}>
        Listen later
      </NavLink>
      <NavLink to="/5" className={getActiveClass}>
        History
      </NavLink>
      <NavLink to="/7" className={getActiveClass}>
        Podcasts
      </NavLink>
    </div>
  )
}
export default Header
