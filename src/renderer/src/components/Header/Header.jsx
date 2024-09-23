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
import { usePlaylists } from '../../Contexts/PlaylistsContex'

function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')
  const { playlists } = usePlaylists()
  return (
    <div className="navbar" id="Header">
      <div className="nav-sec">
        <div className="sec-t">Current</div>

        <div className="sec-i">
          <NavLink to="/feed" className={getActiveClass}>
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
          {playlists.slice(0, 4).map((playlist, index) => {
            const colors = ['red', 'green', 'blue', 'orange']
            return (
              <MiniList
                getActiveClass={getActiveClass}
                list={playlist}
                key={index}
                color={colors[index]}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default Header
function MiniList({ getActiveClass, color, list }) {
  return (
    <NavLink to={`/playlists/${list.path}`} className={getActiveClass}>
      <GoDotFill color={color} /> {list.nombre}
    </NavLink>
  )
}
