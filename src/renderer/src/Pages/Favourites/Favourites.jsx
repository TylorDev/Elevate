import './Favourites.scss'
import { useLikes } from '../../Contexts/LikeContext'
import { Button } from '../../Components/Button/Button'
import { FaPlay } from 'react-icons/fa'
import { GoPencil } from 'react-icons/go'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { Cola } from '../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useEffect, useState } from 'react'
import { BiShuffle } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { dataToImageUrl } from '../../Contexts/utils'

function Favourites() {
  const { dir } = useParams()
  const { getLikes, likes } = useLikes()
  const [back, setBack] = useState()
  const { handleResume, getImage } = useSuper()
  useEffect(() => {
    getLikes()
  }, [])

  useEffect(() => {
    if (dir === 'resume' && likes.length > 0) {
      handleResume(likes)
    }
    if (likes.cover) {
      const img = getImage('Likes', likes.cover)
      setBack(img)
    }
  }, [likes, dir])

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  if (!likes) {
    return <div>Cargando...</div> // O un mensaje adecuado de "cargando"
  }

  return (
    <div className="PlaylistPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img src={back} alt="" />
          </div>
          <div className="pgl-name">{'Favourites'}</div>

          <div className="pgl-time">{formatTimestamp(Date.now())}</div>
          <div className="pgl-data">
            <span>{0} vistas •</span>
            <span> {likes?.fileInfos?.length || 0} pistas •</span>

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
        <Cola list={likes.fileInfos} name={'favourites'} />
      </div>
    </div>
  )
}
export default Favourites
