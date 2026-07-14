import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiBarChartBoxLine, RiHeartLine } from 'react-icons/ri'
import { useI18n } from '../../../Contexts/I18nContext'
import { useLikes } from '../../../Contexts/LikeContext'
import Cola from '../../Cola/Cola'
import QueueEmptyState from '../QueueEmptyState'
import './LikesQueueTab.scss'

function LikesQueueTab({ isActive }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { getLikes, likes } = useLikes()
  const [likesLoading, setLikesLoading] = useState(false)

  useEffect(() => {
    if (isActive && !likes?.fileInfos) {
      setLikesLoading(true)
      void getLikes()
        .catch((error) => {
          console.error('Error loading liked songs:', error)
        })
        .finally(() => {
          setLikesLoading(false)
        })
    }
  }, [getLikes, isActive, likes?.fileInfos])

  const handleViewStatistics = useCallback(() => {
    navigate('/statistics')
  }, [navigate])

  const emptyState = (
    <QueueEmptyState
      icon={<RiHeartLine />}
      title={t('queue.emptyLikesTitle')}
      description={t('queue.emptyLikesDescription')}
      actionLabel={t('queue.viewStatistics')}
      actionIcon={<RiBarChartBoxLine />}
      onAction={handleViewStatistics}
    />
  )

  return (
    <div className="LikesQueueTab">
      <Cola
        height="100%"
        list={likes?.fileInfos || []}
        name="favourites"
        redirectActiveToMusic
        isLoading={likesLoading && !likes?.fileInfos}
        emptyState={emptyState}
        preserveOrder
        enablePinMove
        pinMoveScope="source-local"
        sourceKey="favourites"
      />
    </div>
  )
}

export default LikesQueueTab
