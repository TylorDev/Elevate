import { useCallback, useState } from 'react'
import { RiShuffleLine } from 'react-icons/ri'
import { useI18n } from '../../../Contexts/I18nContext'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { useQueue } from '../../../Contexts/QueueContext'
import Cola from '../../Cola/Cola'
import QueueEmptyState from '../QueueEmptyState'
import { playRandomPlaylistOrDirectory } from '../playRandomFallback'
import './CurrentQueueTab.scss'

function CurrentQueueTab({ onSelectTab }) {
  const { t } = useI18n()
  const { addPlaylisthistory } = usePlaylists()
  const { playQueueShuffled, queueState, setCurrentFile, setCurrentIndex, reorderCurrentQueue } =
    useQueue()
  const [playingFallback, setPlayingFallback] = useState(false)

  const handlePlayFallback = useCallback(async () => {
    if (playingFallback) {
      return
    }

    setPlayingFallback(true)

    try {
      const played = await playRandomPlaylistOrDirectory({
        addPlaylisthistory,
        playQueueShuffled,
        t
      })

      if (!played) {
        onSelectTab?.('directories')
      }
    } finally {
      setPlayingFallback(false)
    }
  }, [addPlaylisthistory, onSelectTab, playQueueShuffled, playingFallback, t])

  const emptyState = (
    <QueueEmptyState
      icon={<RiShuffleLine />}
      title={t('queue.emptyCurrentTitle')}
      description={t('queue.emptyCurrentDescription')}
      actionLabel={t('queue.playRandomFallback')}
      actionIcon={<RiShuffleLine />}
      onAction={() => void handlePlayFallback()}
      disabled={playingFallback}
    />
  )

  return (
    <div className="CurrentQueueTab">
      <Cola
        list={queueState.currentQueue}
        height="100%"
        name="currentQueue"
        redirectActiveToMusic
        preserveOrder
        enablePinMove
        pinMoveScope="session-queue"
        sourceKey="currentQueue"
        onMoveCommit={reorderCurrentQueue}
        emptyState={emptyState}
        onPlayOverride={(file, index) => {
          setCurrentFile(file)
          setCurrentIndex(index)
        }}
      />
    </div>
  )
}

export default CurrentQueueTab
