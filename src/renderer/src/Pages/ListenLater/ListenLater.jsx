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
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'

function ListenLater() {
  const { handleResume } = useSuper()
  const { dir } = useParams()
  const { getlatersongs, later } = useMini()
  useEffect(() => {
    getlatersongs()
  }, [])

  useEffect(() => {
    if (dir === 'resume' && later.length > 0) {
      // console.log('lista cargada!')
      handleResume(later)
    }
  }, [later, dir])

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
            <img src={later.cover} alt="" />
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
        <Cola list={later.fileInfos} name={'listen-later'} />
      </div>
    </div>
  )
}
export default ListenLater
