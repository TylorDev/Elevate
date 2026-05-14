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

function PlaylistPage() {
  const { dir } = useParams()
  const [current, setCurrent] = useState([])

  const [isVisible, setIsVisible] = useState(false)
  const [back, setBack] = useState()
  const { getUniqueList, updatePlaylistMetadata } = usePlaylists()
  const { handleQueueAndPlay, getImage } = useSuper()

  useEffect(() => {
    async function getData() {
      await getUniqueList(setCurrent, dir)
    }

    getData()
  }, [dir, getUniqueList])

  useEffect(() => {
    if (current?.playlistData) {
      const data = current?.playlistData
      const coverToUse = current.effectiveCover || current.cover
      const cover = getImage(data.path, coverToUse)
      setBack(cover)
    }
  }, [current, getImage])

  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const handleUpdatePlaylistMetadata = async (path, payload) => {
    const response = await updatePlaylistMetadata(path, payload)

    if (response?.success && response.playlist) {
      setCurrent((previous) => {
        if (!previous?.playlistData) {
          return previous
        }

        return {
          ...previous,
          playlistData: {
            ...previous.playlistData,
            ...response.playlist
          },
          effectiveCover: response.effectiveCover ?? previous.effectiveCover,
          cover:
            payload.coverMode === 'auto'
              ? previous.cover
              : response.effectiveCover ?? previous.cover,
          coverConfig: response.coverConfig ?? previous.coverConfig
        }
      })
    }

    return response
  }

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  if (!current || !current.playlistData) {
    return <div>Cargando...</div>
  }

  const data = current.playlistData
  const suggestedCovers = current.suggestedCovers || []
  const coverConfig = current.coverConfig || {}

  return (
    <div className="PlaylistPage">
      <Modal isVisible={isVisible} closeModal={closeModal}>
        <PlaylistForm
          playlist={current.playlistData}
          suggestedCovers={suggestedCovers}
          coverConfig={coverConfig}
          automaticCover={current.cover}
          effectiveCover={current.effectiveCover}
          onUpdate={handleUpdatePlaylistMetadata}
          close={closeModal}
        />
      </Modal>
      <div className="plg-controls">
        <div className="plg">
          <div className="plg-cover">
            <img src={back} alt="SIN ALBUM" />
          </div>
          <div className="pgl-name">{data.nombre}</div>

          <div className="pgl-time">{formatTimestamp(data.createdAt)}</div>
          <div className="pgl-data">
            <span>{data.totalplays} views •</span>
            <span> {data.numElementos} tracks •</span>
            <span> {formatDuration(data.duracion)} </span>
          </div>
          <div className="pgl-buttton">
            <Button onClick={openModal}>
              <GoPencil />{' '}
            </Button>
            <Button
              onClick={async () => {
                await handleQueueAndPlay(undefined, undefined, data.path)
              }}
            >
              <FaPlay />
            </Button>
            <DropdownMenu options={[]} onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="plg-cola">
        <Cola list={current.processedData} name={dir} />
      </div>
    </div>
  )
}
export default PlaylistPage
