import { useQueue } from '../../../Contexts/QueueContext'
import Cola from '../../Cola/Cola'
import './CurrentQueueTab.scss'

function CurrentQueueTab() {
  const { queueState, setCurrentFile, setCurrentIndex, reorderCurrentQueue } = useQueue()

  return (
    <div className="CurrentQueueTab">
      <Cola
        list={queueState.currentQueue}
        height="100%"
        name="currentQueue"
        preserveOrder
        enablePinMove
        pinMoveScope="session-queue"
        sourceKey="currentQueue"
        onMoveCommit={reorderCurrentQueue}
        onPlayOverride={(file, index) => {
          setCurrentFile(file)
          setCurrentIndex(index)
        }}
      />
    </div>
  )
}

export default CurrentQueueTab
