/* eslint-disable react/prop-types */

import { useLikes } from '../../Contexts/LikeContext'

import { useMini } from '../../Contexts/MiniContext'
import { FaPlay } from 'react-icons/fa'
import { useSuper } from '../../Contexts/SupeContext'

import './SongItem.scss'
import { Button } from './../Button/Button'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import DropdownMenu from '../DropMenu/DropMenu'
import Modal from './../Modal/Modal'

import 'react-toastify/dist/ReactToastify.css'
import { dataToImageUrl } from '../../Contexts/utils'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
export function SongItem({ file, index, cola, name, filePath, padreActions }) {
  const { handleSongClick, currentFile, addSong } = useSuper()
  const [isLikedo, setIsLikedo] = useState(false)
  const { getFileByFilePath } = usePlaylists()
  const { toggleLike, isLiked } = useLikes()
  const { removeTrack } = useSuper()
  const { agregarElemento, eliminarElemento, latersong } = useMini()
  const [isVisible, setIsVisible] = useState(false)
  const [mycover, setMyCover] = useState('')
  useEffect(() => {
    const fileData = getFileByFilePath(file.filePath)
    setMyCover(fileData?.cover)
  }, [mycover, file])
  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const actionsHijo = {
    'agregar a cola': () => agregarElemento(file),
    addlater: () => latersong(file),
    'abrir modal': () => openModal()
  }

  // Combina las acciones del padre y del hijo
  const combinedActions = { ...padreActions, ...actionsHijo }

  const handleSelect = (option) => {
    const action = combinedActions[option]
    if (action) {
      action(file)
    } else {
      console.log('Opción no reconocida:', option)
    }
  }

  useEffect(() => {
    setIsLikedo(file.liked)
    isLiked(file.filePath, file.fileName, setIsLikedo)
  }, [file.liked])

  const handleClick = () => {
    // Llama a `toggleLike` para realizar su acción
    toggleLike()
    // Cambia el estado local después de la acción
    setIsLikedo((prevState) => !prevState)
    // Aquí puedes agregar lógica adicional si es necesario
    console.log('Estado actualizado:', !isLikedo)
  }

  return (
    <li
      key={index}
      className={file.filePath == currentFile.filePath ? 'songItem active' : 'songItem'}
      onClick={() => handleSongClick(file, index, cola, name)}
    >
      <div className="cover">
        <div className="ico">
          <FaPlay />
        </div>

        <img src={mycover} alt="sin cover" />
      </div>

      <div className="songdata">
        <span>{file.fileName}</span>
        <span>
          {file.artist || 'Unknow'} • {file.play_count} vistas • {file.bpm} bpm
        </span>
      </div>

      <div className={isLikedo ? 'optiones liked' : '  optiones'}>
        <Button className={'btnLike'} onClick={handleClick}>
          {buttonText}
        </Button>
        <DropdownMenu options={Object.keys(combinedActions)} onSelect={handleSelect} />
      </div>

      <Modal isVisible={isVisible} closeModal={closeModal}>
        <div>
          {' '}
          {file.filePath}
          <button
            onClick={() => {
              addSong('C:\\Users\\yonte\\Documents\\prueba.m3u', file)
            }}
          >
            agrega a XDD playlist.{' '}
          </button>
        </div>
      </Modal>

      <div className="stime">
        {Math.floor(file.duration / 60)}:
        {Math.floor(file.duration % 60)
          .toString()
          .padStart(2, '0')}
      </div>
    </li>
  )
}
