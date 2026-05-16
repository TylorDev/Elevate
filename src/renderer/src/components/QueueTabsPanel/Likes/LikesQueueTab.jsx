import { useEffect } from 'react'
import { useLikes } from '../../../Contexts/LikeContext'
import Cola from '../../Cola/Cola'
import './LikesQueueTab.scss'

function LikesQueueTab({ isActive }) {
  const { getLikes, likes } = useLikes()

  useEffect(() => {
    if (isActive && !likes?.fileInfos) {
      getLikes()
    }
  }, [getLikes, isActive, likes?.fileInfos])

  return (
    <div className="LikesQueueTab">
      <Cola
        height="100%"
        list={likes?.fileInfos || []}
        name="favourites"
        preserveOrder
        enablePinMove
        pinMoveScope="source-local"
        sourceKey="favourites"
      />
    </div>
  )
}

export default LikesQueueTab
