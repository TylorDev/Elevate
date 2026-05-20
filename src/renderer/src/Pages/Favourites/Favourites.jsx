import './Favourites.scss'
import { useLikes } from '../../Contexts/LikeContext'
import { Button } from '../../Components/Button/Button'
import { FaPlay } from 'react-icons/fa'

import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { Cola } from '../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useEffect, useState } from 'react'
import { BiShuffle } from 'react-icons/bi'
import { useParams } from 'react-router-dom'
import { useImages } from '../../Contexts/ImagesContext'
import { useQueue } from '../../Contexts/QueueContext'
import { Skeleton } from '../../components/Skeleton/Skeleton'

function Favourites() {
  const { getLikes, likes } = useLikes()
  const [back, setBack] = useState()
  const { getCollectionCoverUrl } = useImages()
  const { handleQueueAndPlay, toggleShuffle } = useQueue()
  useEffect(() => {
    getLikes()
  }, [])

  useEffect(() => {
    if (likes.cover) {
      const img = getCollectionCoverUrl('Likes', likes.cover)
      setBack(img)
    }
  }, [getCollectionCoverUrl, likes])

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  if (!likes.fileInfos) {
    return <LoadLikes /> // O un mensaje adecuado de "cargando"
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
            <span>System •</span>
            <span> {likes?.fileInfos?.length || 0} tracks •</span>

            <span> {formatDuration(likes.totalDuration)} </span>
          </div>
          <div className="pgl-buttton">
            <Button
              onClick={async () => {
                await handleQueueAndPlay(likes.fileInfos[0], 0, 'favourites')

                toggleShuffle()
              }}
            >
              <BiShuffle />
            </Button>
            <Button
              onClick={async () => {
                await handleQueueAndPlay(likes.fileInfos[0], 0, 'favourites')
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={[]} onSelect={handleSelect} />
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
function LoadLikes() {
  return (
    <div className="PlaylistPage" id="LoadPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <Skeleton />
          </div>
          <div className="pgl-name">{'Favourites'}</div>

          <div className="pgl-time">{formatTimestamp(Date.now())}</div>
          <div className="pgl-data">
            <span>{0} views •</span>
            <span> {0} tracks •</span>
            <span> {'00:00:00'} </span>
          </div>
          <div className="pgl-buttton">
            <Button>
              <BiShuffle />
            </Button>
            <Button>
              <FaPlay />
            </Button>
            <DropdownMenu options={[]} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola name={'listen-later'} />
      </div>
    </div>
  )
}
