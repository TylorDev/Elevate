import './Music.scss'

import { Cola } from '../../Components/Cola/Cola'

import { useSuper } from '../../Contexts/SupeContext'
import { CurrentPlaying } from './../Feed/CurrentPlaying'

function Music() {
  const { queueState } = useSuper()
  return (
    <div className="Music">
      <div className="reproductor">
        <CurrentPlaying />
      </div>

      <div className="reprod-cola">
        <Cola list={queueState.currentQueue} name={'favourites'} />
      </div>
    </div>
  )
}
export default Music
