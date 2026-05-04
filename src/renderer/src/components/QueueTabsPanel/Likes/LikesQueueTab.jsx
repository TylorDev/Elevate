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
      <Cola list={likes?.fileInfos || []} name="favourites" />
    </div>
  )
}

export default LikesQueueTab
