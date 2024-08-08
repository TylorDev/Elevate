import { Link, useNavigate } from 'react-router-dom'
import './Music.scss'
import { AudioPlayer } from '../../AudioPlayer'
import { useEffect } from 'react'
import { useAppContext } from '../../Contexts/AppContext'
import { Cola } from './../../Cola'

function Music() {
  const navigate = useNavigate()
  const { queue } = useAppContext()
  return (
    <div className="Music">
      Music
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
