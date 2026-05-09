import { memo, useMemo, useRef } from 'react'
import { FaPlay, FaEye } from 'react-icons/fa'
import { LuHeart, LuHeartOff } from 'react-icons/lu'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import { Button } from './../Button/Button'
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

export const SongItemView = memo(function SongItemView({
  title,
  artist,
  playCount,
  durationText,
  coverUrl,
  isActive = false,
  progressPercent = 0,
  isLiked = false,
  style,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect
}) {
  const menuRef = useRef(null)

  const handleContextMenu = (event) => {
    if (menuRef.current) {
      menuRef.current.open(event)
    }
  }

  return (
    <li className="visible" style={style} onClick={onPlay} onContextMenu={handleContextMenu}>
      <div className={isActive ? 'songItem active' : 'songItem'}>
        <div className="song-progress">
          <div className="song-progress-fill" style={{ width: `${isActive ? progressPercent : 0}%` }} />
        </div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>
          <img src={coverUrl} loading="lazy" alt="" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{title}</span>
          <span className="song-data-meta">
            {artist || 'Unknow'} â€¢{' '}
            <span className="song-views">
              <FaEye /> {playCount}
            </span>
          </span>
        </div>

        <div className={isLiked ? 'optiones liked' : '  optiones'}>
          <Button className="btnLike" onClick={onToggleLike}>
            {isLiked ? <LuHeart /> : <LuHeartOff />}
          </Button>
        </div>

        <div className="stime">{durationText}</div>

        <OverflowMenu
          ref={menuRef}
          options={menuOptions}
          onSelect={onMenuSelect}
          showButton={false}
        />
      </div>
    </li>
  )
}, areSongItemViewPropsEqual)

function SongItemContainer({
  file,
  index,
  style,
  coverUrl,
  isActive = false,
  progressPercent = 0,
  isLiked = false,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect
}) {
  if (!file) {
    return <div className="songItem loading">Cargando...</div>
  }

  const durationText = useMemo(
    () =>
      `${Math.floor(file.duration / 60)}:${Math.floor(file.duration % 60)
        .toString()
        .padStart(2, '0')}`,
    [file.duration]
  )

  return (
    <SongItemView
      title={file.fileName}
      artist={file.artist}
      playCount={file.play_count}
      durationText={durationText}
      coverUrl={coverUrl}
      isActive={isActive}
      progressPercent={progressPercent}
      isLiked={isLiked}
      style={style}
      menuOptions={menuOptions}
      onPlay={() => onPlay?.(file, index)}
      onToggleLike={(event) => onToggleLike?.(event, file, isLiked)}
      onMenuSelect={(optionId) => onMenuSelect?.(optionId, file, index)}
    />
  )
}

function areSongItemViewPropsEqual(prevProps, nextProps) {
  return (
    prevProps.title === nextProps.title &&
    prevProps.artist === nextProps.artist &&
    prevProps.playCount === nextProps.playCount &&
    prevProps.durationText === nextProps.durationText &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.progressPercent === nextProps.progressPercent &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

function areSongItemContainerPropsEqual(prevProps, nextProps) {
  return (
    prevProps.file === nextProps.file &&
    prevProps.index === nextProps.index &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.progressPercent === nextProps.progressPercent &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

export const SongItem = memo(SongItemContainer, areSongItemContainerPropsEqual)
