import './ListenLater.scss'
import { useLikes } from '../../Contexts/LikeContext'
import { Button } from '../../Components/Button/Button'
import { FaPlay } from 'react-icons/fa'
import { GoPencil } from 'react-icons/go'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { Cola } from '../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useEffect } from 'react'
import { BiShuffle } from 'react-icons/bi'
import { useMini } from '../../Contexts/MiniContext'

function ListenLater() {
  const { getlatersongs, later } = useMini()
  useEffect(() => {
    getlatersongs()
  }, [])

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  useEffect(() => {
    console.log(later)
  }, [later])

  if (!later) {
    return <div>Cargando...</div> // O un mensaje adecuado de "cargando"
  }

  return (
    <div className="PlaylistPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img
              src="https://i.pinimg.com/736x/d5/db/17/d5db1719cc626f12e9fdae3ac8a829ea.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/db/d5/d2/dbd5d2dcc677ac92ddeb12fe4da2e198.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/2d/55/10/2d5510158e18e0c483b008d8f4e71a7f.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/3e/40/e0/3e40e0e3a22196f2839d718c26f06ebd.jpg"
              alt=""
            />
          </div>
          <div className="pgl-name">{'Listen later'}</div>

          <div className="pgl-time">{formatTimestamp(Date.now())}</div>
          <div className="pgl-data">
            <span>{0} vistas •</span>
            <span> {later.length} pistas •</span>
            <span> {'0h 0m 0s'} </span>
          </div>
          <div className="pgl-buttton">
            <Button>
              <BiShuffle />
            </Button>
            <Button>
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={later} />
      </div>
    </div>
  )
}
export default ListenLater
