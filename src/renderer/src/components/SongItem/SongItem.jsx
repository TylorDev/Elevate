/* eslint-disable react/prop-types */

import { useLikes } from '../../Contexts/LikeContext'

import { useMini } from '../../Contexts/MiniContext'
import { FaPlay } from 'react-icons/fa'
import { useSuper } from '../../Contexts/SupeContext'

import './SongItem.scss'
import { Button } from './../Button/Button'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useEffect, useRef, useState } from 'react'
import DropdownMenu from '../DropMenu/DropMenu'
import Modal from './../Modal/Modal'

import 'react-toastify/dist/ReactToastify.css'

import { FormAddTo } from './FormAddTo'
export function SongItem({ file, index, cola, name, padreActions, style }) {
  const { handleSongClick, currentFile, addSong, getImage } = useSuper()
  const [isLikedo, setIsLikedo] = useState(false)

  const { toggleLike, isLiked } = useLikes()

  const { agregarElemento, latersong } = useMini()
  const [isVisible, setIsVisible] = useState(false)
  const [mycover, setMyCover] = useState('')

  const [isLoaded, setLoaded] = useState(false)
  const elementRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setLoaded(entry.isIntersecting)
      },
      { threshold: 0.1 } // Ajusta este valor según tus necesidades
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (file.picture) {
      const url = getImage(file.filePath, file.picture[0])
      setMyCover(url)
    }
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
    'Agregar a lista': () => openModal()
  }

  // Combina las acciones del padre y del hijo
  const combinedActions = { ...padreActions, ...actionsHijo }

  const handleSelect = (option) => {
    const action = combinedActions[option]
    if (action) {
      action(file, index)
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
      ref={elementRef}
      key={index}
      className={`${isLoaded ? 'visible' : 'invisible'}`}
      // style={style}
      onClick={() => handleSongClick(file, index, cola, name)}
    >
      <div className={file.filePath == currentFile.filePath ? 'songItem active' : 'songItem'}>
        <div className="songIndex">{index + 1}</div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>

          <img src={mycover} alt="sin cover" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{file.fileName}</span>
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
          <FormAddTo file={file} addSong={addSong} />
        </Modal>

        <div className="stime">
          {Math.floor(file.duration / 60)}:
          {Math.floor(file.duration % 60)
            .toString()
            .padStart(2, '0')}
        </div>
      </div>
    </li>
  )
}
