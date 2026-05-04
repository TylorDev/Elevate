import './Music.scss'

import { CurrentPlaying } from './../Feed/CurrentPlaying'

function Music() {
  return (
    <div className="Music">
      <div className="reproductor">
        <CurrentPlaying />
      </div>
    </div>
  )
}
export default Music
