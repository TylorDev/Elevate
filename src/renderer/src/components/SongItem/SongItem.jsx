import { memo, useEffect, useMemo, useState } from 'react'
import { FaPlay, FaPlusCircle, FaClock, FaListUl } from 'react-icons/fa'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useLikes } from '../../Contexts/LikeContext'
import { useMini } from '../../Contexts/MiniContext'
import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useCoverUrl } from '../../hooks/useCoverUrl'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import { Button } from './../Button/Button'
import Modal from './../Modal/Modal'
import { FormAddTo } from './FormAddTo'
import './SongItem.scss'
import 'react-toastify/dist/ReactToastify.css'

export const SongItem = memo(function SongItem({ file, index, cola, name, padreActions, style }) {
  if (!file) {
    return <div className="songItem loading">Cargando...</div>
  }

  const { handleSongClick, currentFile, progress, duration } = useSuper()
  const isActive = file.filePath === currentFile.filePath
  const progressPercent = isActive && duration ? (progress / duration) * 100 : 0

  const [isLikedo, setIsLikedo] = useState(Boolean(file.liked))
  const { addPlaylisthistory } = usePlaylists()
  const { validateLike, toggleLike } = useLikes()

  const { agregarElemento, latersong } = useMini()
  const [isVisible, setIsVisible] = useState(false)
  const mycover = useCoverUrl(file.filePath, 'thumb')

  useEffect(() => {
    const checkStatus = async () => {
      await validateLike(file.filePath, file.title || file.fileName, setIsLikedo)
    }
    checkStatus()
  }, [file.filePath])

  const openModal = () => {
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const menuOptions = useMemo(() => {
    const options = [
      { id: 'add to queue', label: 'Add to queue', icon: <FaPlusCircle /> },
      { id: 'add later', label: 'Add later', icon: <FaClock /> },
      { id: 'add to playlist', label: 'Add to playlist', icon: <FaListUl /> },
    ]
    
    if (padreActions) {
      Object.keys(padreActions).forEach(key => {
        options.push({ id: key, label: key })
      })
    }
    
    return options
  }, [padreActions])

  const combinedActions = useMemo(
    () => ({
      ...padreActions,
      'add to queue': () => agregarElemento(file),
      'add later': () => latersong(file),
      'add to playlist': () => openModal()
    }),
    [agregarElemento, file, latersong, padreActions]
  )

  const handleSelect = (optionId) => {
    const action = combinedActions[optionId]
    if (action) {
      action(file, index)
    } else {
      console.log('Opción no reconocida:', optionId)
    }
  }

  const handleClick = (e) => {
    e.stopPropagation()
    toggleLike(file, isLikedo)
    setIsLikedo((value) => !value)
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
      <div className={isActive ? 'songItem active' : 'songItem'}>
        {isActive && (
          <div className="song-progress">
            <div className="song-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className={`songIndex ${index + 1 >= 100 ? 'infinite' : ''}`}>{index + 1 >= 100 ? '∞' : index + 1}</div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>
          <img src={mycover} loading="lazy" />
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
          <OverflowMenu options={menuOptions} onSelect={handleSelect} />
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
