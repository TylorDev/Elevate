import { Link, useNavigate } from 'react-router-dom'
import './Music.scss'
import { AudioPlayer } from '../../AudioPlayer'
import { useEffect } from 'react'
import { useAppContext } from '../../Contexts/AppContext'

function Music() {
  const { loadCurrentTime, saveCurrentTime } = useAppContext()
  useEffect(() => {
    loadCurrentTime()
  }, [])

  const navigate = useNavigate()
  return (
    <div className="Music">
      Music
      <div
        onClick={() => {
          navigate('/')
          saveCurrentTime()
        }}
      >
        volver
      </div>
      <AudioPlayer />
    </div>
  )
}
export default Music
