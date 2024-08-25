import { useParams } from 'react-router-dom'
import './PlaylistPage.scss'
import { useState } from 'react'
import { useEffect } from 'react'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from './../../Components/Cola/Cola'
import { formatDuration, formatTimestamp } from './../../../timeUtils'
import { Button } from './../../Components/Button/Button'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { GoPencil } from 'react-icons/go'
function PlaylistPage() {
  const { dir } = useParams() // Obtener el parámetro de la URL
  const [current, setCurrent] = useState([])
  const { getUniqueList } = usePlaylists()
  useEffect(() => {
    getUniqueList(setCurrent, dir)
  }, [dir])

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  useEffect(() => {
    console.log(current)
  }, [current])

  if (!current || !current.playlistData) {
    return <div>Cargando...</div> // O un mensaje adecuado de "cargando"
  }

  const data = current.playlistData
  return (
    <div className="PlaylistPage">
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img
              src="https://i.pinimg.com/736x/d5/db/17/d5db1719cc626f12e9fdae3ac8a829ea.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/db/d5/d2/dbd5d2dcc677ac92ddeb12fe4da2e198.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/2d/55/10/2d5510158e18e0c483b008d8f4e71a7f.jpg"
              alt=""
            />
            <img
              src="https://i.pinimg.com/736x/3e/40/e0/3e40e0e3a22196f2839d718c26f06ebd.jpg"
              alt=""
            />
          </div>
          <div className="pgl-name">{data.nombre}</div>

          <div className="pgl-time">{formatTimestamp(data.createdAt)}</div>
          <div className="pgl-data">
            <span>{data.totalplays} vistas •</span>
            <span> {data.numElementos} pistas •</span>
            <span> {formatDuration(data.duracion)} </span>
          </div>
          <div className="pgl-buttton">
            <Button>
              <GoPencil />{' '}
            </Button>
            <Button>
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={current.processedData} />
      </div>
    </div>
  )
}
export default PlaylistPage
