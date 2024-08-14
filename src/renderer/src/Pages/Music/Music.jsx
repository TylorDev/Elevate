import { useNavigate } from 'react-router-dom'
import './Music.scss'

import { useAppContext } from '../../Contexts/AppContext'
import { Cola } from '../../Components/Cola/Cola'
import { AudioPlayer } from './../../Components/AudioPlayer/AudioPlayer'

function Music() {
  const navigate = useNavigate()
  const { queue } = useAppContext()
  return (
    <div className="Music">
      <div
        onClick={() => {
          navigate('/')
        }}
      >
        volver
      </div>
      <Cola list={queue} />
      {console.log(queue)}
    </div>
  )
}
export default Music
