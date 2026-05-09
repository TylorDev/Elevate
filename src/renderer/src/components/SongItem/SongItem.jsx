import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FaPlay, FaPlusCircle, FaClock, FaListUl, FaEye } from 'react-icons/fa'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { useLikes } from '../../Contexts/LikeContext'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useCoverUrl } from '../../hooks/useCoverUrl'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import { Button } from './../Button/Button'
import Modal from './../Modal/Modal'
import { FormAddTo } from './FormAddTo'
import './SongItem.scss'
import 'react-toastify/dist/ReactToastify.css'

function areStylesEqual(prevStyle, nextStyle) {
  if (prevStyle === nextStyle) return true
  if (!prevStyle || !nextStyle) return !prevStyle && !nextStyle

  return (
    prevStyle.top === nextStyle.top &&
    prevStyle.left === nextStyle.left &&
    prevStyle.width === nextStyle.width &&
    prevStyle.height === nextStyle.height
  )
}

function SongItemComponent({
  file,
  index,
  cola,
  name,
  padreActions,
  style,
  isActive = false,
  progressPercent = 0,
  onSongClick,
  isLikedOverride
}) {
  if (!file) {
    return <div className="songItem loading">Cargando...</div>
  }

  const [isLikedo, setIsLikedo] = useState(() => Boolean(isLikedOverride ?? file.liked))
  const { addPlaylisthistory } = usePlaylists()
  const { likesLookup, toggleLike } = useLikes()
  const { agregarElemento, latersong } = useMini()
  const [isVisible, setIsVisible] = useState(false)
  const mycover = useCoverUrl(file.filePath, 'thumb')
  const menuRef = useRef(null)

  useEffect(() => {
    setIsLikedo(Boolean(isLikedOverride ?? likesLookup.get(file.filePath) ?? file.liked))
  }, [file.filePath, file.liked, isLikedOverride, likesLookup])

  const buttonText = isLikedo ? <LuHeart /> : <LuHeartOff />

  const menuOptions = useMemo(() => {
    const options = [
      { id: 'add to queue', label: 'Add to queue', icon: <FaPlusCircle /> },
      { id: 'add later', label: 'Add later', icon: <FaClock /> },
      { id: 'add to playlist', label: 'Add to playlist', icon: <FaListUl /> }
    ]

    if (padreActions) {
      Object.keys(padreActions).forEach((key) => {
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
      'add to playlist': () => setIsVisible(true)
    }),
    [agregarElemento, file, latersong, padreActions]
  )

  const handleSelect = (optionId) => {
    const action = combinedActions[optionId]

    if (action) {
      action(file, index)
    } else {
      console.log('OpciÃ³n no reconocida:', optionId)
    }
  }

  const handleLikeClick = (event) => {
    event.stopPropagation()
    toggleLike(file, isLikedo)
    setIsLikedo((value) => !value)
  }

  const handleItemClick = () => {
    onSongClick?.(file, index, cola, name)

    if (name && !name.startsWith('folder:') && !name.startsWith('/')) {
      addPlaylisthistory(name)
    }
  }

  const handleContextMenu = (event) => {
    if (menuRef.current) {
      menuRef.current.open(event)
    }
  }

  return (
    <li className="visible" style={style} onClick={handleItemClick} onContextMenu={handleContextMenu}>
      <div className={isActive ? 'songItem active' : 'songItem'}>
        <div className="song-progress">
          <div className="song-progress-fill" style={{ width: `${isActive ? progressPercent : 0}%` }} />
        </div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>
          <img src={mycover} loading="lazy" alt="" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{file.fileName}</span>
          <span className="song-data-meta">
            {file.artist || 'Unknow'} â€¢{' '}
            <span className="song-views">
              <FaEye /> {file.play_count}
            </span>
          </span>
        </div>

        <div className={isLikedo ? 'optiones liked' : '  optiones'}>
          <Button className="btnLike" onClick={handleLikeClick}>
            {buttonText}
          </Button>
        </div>

        {isVisible && (
          <Modal isVisible={isVisible} closeModal={() => setIsVisible(false)}>
            <FormAddTo file={file} />
          </Modal>
        )}

        <div className="stime">
          {Math.floor(file.duration / 60)}:
          {Math.floor(file.duration % 60)
            .toString()
            .padStart(2, '0')}
        </div>

        <OverflowMenu
          ref={menuRef}
          options={menuOptions}
          onSelect={handleSelect}
          showButton={false}
        />
      </div>
    </li>
  )
}

function areSongItemPropsEqual(prevProps, nextProps) {
  return (
    prevProps.file === nextProps.file &&
    prevProps.index === nextProps.index &&
    prevProps.cola === nextProps.cola &&
    prevProps.name === nextProps.name &&
    prevProps.padreActions === nextProps.padreActions &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.progressPercent === nextProps.progressPercent &&
    prevProps.onSongClick === nextProps.onSongClick &&
    prevProps.isLikedOverride === nextProps.isLikedOverride &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

export const SongItem = memo(SongItemComponent, areSongItemPropsEqual)
