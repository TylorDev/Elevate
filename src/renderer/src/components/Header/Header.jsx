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
import { useMini } from '../../Contexts/MiniContext'
import { useSuper } from '../../Contexts/SupeContext'

function Header() {
  const getActiveClass = ({ isActive }) => (isActive ? 'activo' : '')
  const { playlists } = usePlaylists()
  const { lista } = useMini()
  const { handleAwaken } = useSuper()
  return (
    <div className="navbar" id="Header">
      <div className="nav-sec">
        <div className="sec-t">Current</div>

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

          <NavLink to="/tracks" className={getActiveClass}>
            <TfiLayoutListThumbAlt /> <span className="Link-name">Tracks </span>
          </NavLink>
          {lista && lista.length > 0 && (
            <NavLink to="/list" className={getActiveClass}>
              <LuListVideo /> <span className="Link-name">List </span>
            </NavLink>
          )}
        </div>
      </div>

      <div className="nav-sec">
        <div className="sec-t">Personal Lists</div>

        <div className="sec-i">
          <NavLink to="/directories" className={getActiveClass}>
            <FaFolderTree />
            <span className="Link-name">Folders </span>
          </NavLink>
          <NavLink to="/playlists" className={getActiveClass}>
            <MdQueueMusic /> <span className="Link-name">Playlists </span>
          </NavLink>
        </div>
      </div>
      <div className="nav-sec">
        <div className="sec-t">System Lists</div>

        <div className="sec-i">
          <NavLink to="/favourites" className={getActiveClass}>
            <FaRegHeart /> <span className="Link-name">Favourites </span>
          </NavLink>
          <NavLink to="/listen-later" className={getActiveClass}>
            <MdOutlineWatchLater /> <span className="Link-name">Listen later </span>
          </NavLink>
        </div>
      </div>
      <div className="nav-sec">
        <div className="sec-t">Stats</div>

        <div className="sec-i">
          <NavLink to="/search" className={getActiveClass}>
            <MdBarChart /> <span className="Link-name">Stats </span>
          </NavLink>
          <NavLink to="/history" className={getActiveClass}>
            <IoCalendarOutline /> <span className="Link-name">History </span>
          </NavLink>
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
