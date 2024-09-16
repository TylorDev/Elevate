import { useParams } from 'react-router-dom'
import './DirPage.scss'
import { useEffect, useState } from 'react'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from './../../Components/Cola/Cola'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { Button } from './../../Components/Button/Button'
import { GoPencil } from 'react-icons/go'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useSuper } from '../../Contexts/SupeContext'

function DirPage() {
  const { directory, play } = useParams()
  const { PlayQueue } = useSuper()
  const { getDirFiles } = useMini()
  const [currentDir, setCurrentDir] = useState([])
  const dir = JSON.parse(decodeURIComponent(directory))
  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }
  useEffect(() => {
    getDirFiles(setCurrentDir, dir.path)
  }, [])

  useEffect(() => {
    if (play === 'true' && currentDir) {
      PlayQueue(currentDir, 'tracks')
    }
  }, [currentDir, play])

  const getLastPart = (path) => {
    // Divide la cadena por el separador de directorios y toma la última parte
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }

  return (
    <div className="PlaylistPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img
              src="https://i.pinimg.com/736x/d5/db/17/d5db1719cc626f12e9fdae3ac8a829ea.jpg"
              alt=""
            />
          </div>
          <div className="pgl-name">{getLastPart(dir.path)}</div>

          <div className="pgl-time">{'00-00-0000'}</div>
          <div className="pgl-data">
            <span>{0} vistas •</span>
            <span> {dir.totalTracks} pistas •</span>
            <span> {formatDuration(dir.totalDuration)} </span>
          </div>
          <div className="pgl-buttton">
            <Button>
              <GoPencil />{' '}
            </Button>
            <Button
              onClick={() => {
                PlayQueue(currentDir, 'tracks')
                console.log('primera cancion:', currentDir[0])
                console.log('lista completa', currentDir)
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={currentDir} name={'tracks'} />
      </div>
    </div>
  )
}
export default DirPage
