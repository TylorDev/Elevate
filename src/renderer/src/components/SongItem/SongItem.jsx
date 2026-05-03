/* eslint-disable react/prop-types */

import { useLikes } from '../../Contexts/LikeContext'

import { useMini } from '../../Contexts/MiniContext'
import { FaPlay } from 'react-icons/fa'
import { useSuper } from '../../Contexts/SupeContext'

import './SongItem.scss'
import { Button } from './../Button/Button'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { memo, useEffect, useMemo, useState } from 'react'
import DropdownMenu from '../DropMenu/DropMenu'
import Modal from './../Modal/Modal'

import 'react-toastify/dist/ReactToastify.css'

import { FormAddTo } from './FormAddTo'
import { CircularProgress } from '@mui/material'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useCoverUrl } from '../../hooks/useCoverUrl'
export const SongItem = memo(function SongItem({ file, index, cola, name, padreActions, style }) {
  if (!file) {
    return <LoadSongItem />
  }

  const { handleSongClick, currentFile } = useSuper()
  const [isLikedo, setIsLikedo] = useState(Boolean(file.liked))
  const { addPlaylisthistory } = usePlaylists()
  const { toggleLike } = useLikes()

  const { agregarElemento, latersong } = useMini()
  const [isVisible, setIsVisible] = useState(false)
  const mycover = useCoverUrl(file.filePath, 'thumb')

  useEffect(() => {
    setIsLikedo(Boolean(file.liked))
  }, [file.filePath, file.liked])
  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const combinedActions = useMemo(
    () => ({
      ...padreActions,
      'add to queue': () => agregarElemento(file),
      'add later': () => latersong(file),
      'add to playlist': () => openModal()
      // 'Obtener Bpm': () => handleGetBPMClick(file)
    }),
    [agregarElemento, file, latersong, padreActions]
  )

  const handleSelect = (option) => {
    const action = combinedActions[option]
    if (action) {
      action(file, index)
    } else {
      console.log('Opción no reconocida:', option)
    }
  }

  const handleClick = (e) => {
    e.stopPropagation() // Detiene la propagación del evento
    toggleLike(file, isLikedo)
    setIsLikedo((value) => !value)

    console.log('Estado actualizado:', !isLikedo)
  }

  return (
    <li
      key={index}
      className="visible"
      style={style}
      onClick={() => {
        handleSongClick(file, index, cola, name)
        if (name && !name.startsWith('folder:') && !name.startsWith('/')) {
          addPlaylisthistory(name)
        }
      }}
    >
      <div className={file.filePath == currentFile.filePath ? 'songItem active' : 'songItem'}>
        <div className="songIndex">{index + 1}</div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>

          <img src={mycover || undefined} alt="sin cover" loading="lazy" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{file.fileName}</span>
          <span className="song-data-meta">
            {file.artist || 'Unknow'} • {file.play_count} views
          </span>
        </div>

        <div className={isLikedo ? 'optiones liked' : '  optiones'}>
          <Button className={'btnLike'} onClick={handleClick}>
            {buttonText}
          </Button>
          <DropdownMenu options={Object.keys(combinedActions)} onSelect={handleSelect} />
        </div>

        {isVisible && (
          <Modal isVisible={isVisible} closeModal={closeModal}>
            <FormAddTo file={file} />
          </Modal>
        )}

        <div className="stime">
          {Math.floor(file.duration / 60)}:
          {Math.floor(file.duration % 60)
            .toString()
            .padStart(2, '0')}
        </div>
      </div>
    </li>
  )
})

function LoadSongItem() {
  return (
    <li className={`${true ? 'visible' : 'invisible'}`} id="LoadSongItem">
      <div className={false ? 'songItem active' : 'songItem'} style={{}}>
        <CircularProgress />
      </div>
    </li>
  )
}
export default SongItem
