import { useNavigate } from 'react-router-dom'
import './Music.scss'

import { Cola } from '../../Components/Cola/Cola'

import { useSuper } from '../../Contexts/SupeContext'

function Music() {
  const navigate = useNavigate()
  const { queueState } = useSuper()
  return (
    <div className="Music">
      <div
        onClick={() => {
          navigate('/')
        }}
      >
        volver
      </div>
      <Cola list={queueState.currentQueue} />
    </div>
  )
}
export default Music
