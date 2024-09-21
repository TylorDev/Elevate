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
import { useSuper } from '../../Contexts/SupeContext'
import Modal from '../../Components/Modal/Modal'
import PlaylistForm from './../../Components/PlaylistForm/PlaylistForm'
import { dataToImageUrl } from '../../Contexts/utils'
import { useMini } from '../../Contexts/MiniContext'

function PlaylistPage() {
  const { dir } = useParams() // Obtener el parámetro de la URL
  const [current, setCurrent] = useState([])

  const [isVisible, setIsVisible] = useState(false) // Moved to the top
  const [back, setBack] = useState()
  const { getUniqueList, updatePlaylist, playlists, getAlbumByFilePath } = usePlaylists()
  const { queueState, handleQueueAndPlay, removeTrack } = useSuper() // Combined the two useSuper calls
  const { eliminarElemento } = useMini()
  useEffect(() => {
    async function getData() {
      await getUniqueList(setCurrent, dir)
    }

    getData()
  }, [dir, queueState, playlists])

  useEffect(() => {
    if (current?.playlistData) {
      const data = current?.playlistData
      const cover = getAlbumByFilePath(data.path)
      setBack(cover)
      console.log('cover', cover)
    }
  }, [current, back])

  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  if (!current || !current.playlistData) {
    return <div>Cargando...</div> // O un mensaje adecuado de "cargando"
  }

  const data = current.playlistData
  const actions = {
    'Quitar de la lista': (file, index) => {
      console.log('eliminando a ', file.fileName)
      removeTrack(data.path, index)
    }
  }

  return (
    <div className="PlaylistPage">
      <Modal isVisible={isVisible} closeModal={closeModal}>
        <PlaylistForm
          playlist={current.playlistData}
          onUpdate={updatePlaylist}
          close={closeModal}
        />
      </Modal>
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img src={back?.cover} alt="SIN ALBUM" />
          </div>
          <div className="pgl-name">{data.nombre}</div>

          <div className="pgl-time">{formatTimestamp(data.createdAt)}</div>
          <div className="pgl-data">
            <span>{data.totalplays} vistas •</span>
            <span> {data.numElementos} pistas •</span>
            <span> {formatDuration(data.duracion)} </span>
          </div>
          <div className="pgl-buttton">
            <Button onClick={openModal}>
              <GoPencil />{' '}
            </Button>
            <Button
              onClick={async () => {
                await handleQueueAndPlay(undefined, undefined, data.path)
                // console.log('Nombre en PlaylistPagePlayClick: ' + (data.path || '[sin nombre]'))
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={current.processedData} name={dir} filePath={dir} actions={actions} />
      </div>
    </div>
  )
}
export default PlaylistPage
