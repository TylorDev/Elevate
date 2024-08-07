import { Link } from 'react-router-dom'
import './Music.scss'
import { AudioPlayer } from '../../AudioPlayer'

function Music() {
  return (
    <div className="Music">
      Music
      <Link to={'/'}>volver</Link>
    </div>
  )
}
export default Music
