/* eslint-disable react/prop-types */

import { useLikes } from '../../Contexts/LikeContext'
import { FaPlay } from 'react-icons/fa'
import { useSuper } from '../../Contexts/SupeContext'
import { BinToBlob } from './../../Contexts/utils'
import './SongItem.scss'
import { Button } from './../Button/Button'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import DropdownMenu from '../DropMenu/DropMenu'

export function SongItem({ file, index, cola }) {
  const { currentIndex, handleSongClick } = useSuper()
  const [isLikedo, setIsLikedo] = useState(false)
  const { toggleLike, isLiked } = useLikes()

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
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
      className={index === currentIndex ? 'songItem active' : 'songItem'}
      onClick={() => handleSongClick(file, index, cola)}
    >
      <div className="cover">
        <div className="ico">
          <FaPlay />
        </div>

        <img src={BinToBlob(file?.picture?.[0] || {})} alt="" />
      </div>

      <div className="songdata">
        <span>{file.fileName}</span>
        <span>{file.artist || 'Unknow'}</span>
      </div>

      <div className={isLikedo ? 'optiones liked' : '  optiones'}>
        <Button className={'btnLike'} onClick={handleClick}>
          {buttonText}
        </Button>
        <DropdownMenu options={['Option 1', 'Option 2', 'Option 3']} onSelect={handleSelect} />
      </div>

      <div className="stime">
        {Math.floor(file.duration / 60)}:
        {Math.floor(file.duration % 60)
          .toString()
          .padStart(2, '0')}
      </div>
    </li>
  )
}
