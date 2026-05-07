import { useSession } from '../../../Contexts/SessionContext'
import Cola from '../../Cola/Cola'
import './CurrentQueueTab.scss'

function CurrentQueueTab() {
  const { queueState } = useSession()

  return (
    <div className="CurrentQueueTab">
      <Cola list={queueState.currentQueue} name="currentQueue" />
    </div>
  )
}

export default CurrentQueueTab
