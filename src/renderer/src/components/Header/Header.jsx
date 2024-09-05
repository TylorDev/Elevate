import './Header.scss'
import { NavLink } from 'react-router-dom'
function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')

  return (
    <div className="navbar" id="Header">
      <NavLink to="/" className={getActiveClass}>
        Feed
      </NavLink>
      <NavLink to="/list" className={getActiveClass}>
        Lista
      </NavLink>
      <NavLink to="/tracks" className={getActiveClass}>
        Tracks
      </NavLink>
      <NavLink to="/playlists" className={getActiveClass}>
        Playlists
      </NavLink>
      <NavLink to="/search" className={getActiveClass}>
        Statistics
      </NavLink>
      <NavLink to="/favourites" className={getActiveClass}>
        Favourites
      </NavLink>
      <NavLink to="/listen-later" className={getActiveClass}>
        Listen later
      </NavLink>
      <NavLink to="/history" className={getActiveClass}>
        History
      </NavLink>
      <NavLink to="/directories" className={getActiveClass}>
        Folders
      </NavLink>
    </div>
  )
}
export default Header
