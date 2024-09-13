/* eslint-disable react/prop-types */

import { useLikes } from '../../Contexts/LikeContext'

import { useMini } from '../../Contexts/MiniContext'
import { FaPlay } from 'react-icons/fa'
import { useSuper } from '../../Contexts/SupeContext'
import { BinToBlob } from './../../Contexts/utils'
import './SongItem.scss'
import { Button } from './../Button/Button'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import DropdownMenu from '../DropMenu/DropMenu'
import Modal from './../Modal/Modal'
import { Bounce, toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
export function SongItem({ file, index, cola, name, filePath }) {
  const { currentIndex, handleSongClick, currentFile, addSong } = useSuper()
  const [isLikedo, setIsLikedo] = useState(false)
  const { toggleLike, isLiked } = useLikes()
  const { removeTrack } = useSuper()
  const { agregarElemento, eliminarElemento } = useMini()
  const [isVisible, setIsVisible] = useState(false)

  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const handleSelect = (option) => {
    if (option === 'eliminar') {
      console.log(`Selected option: ${option}`)
      removeTrack(filePath, index)
    }

    if (option === 'abrir modal') {
      openModal()
    }

    if (option === 'agregar a cola') {
      agregarElemento(file)
    }

    if (option === 'quitar elemento') {
      eliminarElemento(file)
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

        <img src={file.cover} alt="" />
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
        <DropdownMenu
          options={['eliminar', 'abrir modal', 'agregar a cola', 'quitar elemento']}
          onSelect={handleSelect}
        />
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
