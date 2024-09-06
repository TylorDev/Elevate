import './Header.scss'
import { NavLink } from 'react-router-dom'
import { PiWaveform } from 'react-icons/pi'
import { MdBarChart, MdOutlineWatchLater, MdQueueMusic } from 'react-icons/md'
import { FaRegHeart } from 'react-icons/fa'
import { IoCalendarOutline } from 'react-icons/io5'
import { LuListVideo } from 'react-icons/lu'
import { TfiLayoutListThumbAlt } from 'react-icons/tfi'
import { FaFolderTree } from 'react-icons/fa6'
import { GoDotFill } from 'react-icons/go'

function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')

  return (
    <div className="navbar" id="Header">
      <div className="nav-sec">
        <div className="sec-t">Current</div>

        <div className="sec-i">
          <NavLink to="/" className={getActiveClass}>
            <PiWaveform /> Feed
          </NavLink>
          <NavLink to="/list" className={getActiveClass}>
            <LuListVideo /> Lista
          </NavLink>
          <NavLink to="/tracks" className={getActiveClass}>
            <TfiLayoutListThumbAlt /> Tracks
          </NavLink>
        </div>
      </div>

      <div className="nav-sec">
        <div className="sec-t">Personal Lists</div>

        <div className="sec-i">
          <NavLink to="/directories" className={getActiveClass}>
            <FaFolderTree /> Folders
          </NavLink>
          <NavLink to="/playlists" className={getActiveClass}>
            <MdQueueMusic /> Playlists
          </NavLink>
        </div>
      </div>
      <div className="nav-sec">
        <div className="sec-t">System Lists</div>

        <div className="sec-i">
          <NavLink to="/favourites" className={getActiveClass}>
            <FaRegHeart /> Favourites
          </NavLink>
          <NavLink to="/listen-later" className={getActiveClass}>
            <MdOutlineWatchLater /> Listen later
          </NavLink>
        </div>
      </div>
      <div className="nav-sec">
        <div className="sec-t">Stats</div>

        <div className="sec-i">
          <NavLink to="/search" className={getActiveClass}>
            <MdBarChart /> Statistics
          </NavLink>
          <NavLink to="/history" className={getActiveClass}>
            <IoCalendarOutline /> History
          </NavLink>
        </div>
      </div>

      <div className="nav-sec">
        <div className="sec-t">User</div>

        <div className="sec-i">
          <NavLink to="/111" className={getActiveClass}>
            <GoDotFill color="red" /> Lista 1
          </NavLink>
          <NavLink to="/222" className={getActiveClass}>
            <GoDotFill color="green" /> Lista 2
          </NavLink>
          <NavLink to="/333" className={getActiveClass}>
            <GoDotFill color="yellow" /> Lista 3
          </NavLink>
          <NavLink to="/444" className={getActiveClass}>
            <GoDotFill color="purple" /> Lista 4
          </NavLink>
        </div>
      </div>
    </div>
  )
}
export default Header
