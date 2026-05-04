import { useSuper } from '../../../Contexts/SupeContext'
import Cola from '../../Cola/Cola'
import './CurrentQueueTab.scss'

function CurrentQueueTab() {
  const { queueState } = useSuper()

  return (
    <div className="CurrentQueueTab">
      <Cola list={queueState.currentQueue} name="currentQueue" />
    </div>
  )
}

export default CurrentQueueTab
