import { memo, useMemo, useRef } from 'react'
import { FaPlay, FaEye } from 'react-icons/fa'
import { LuHeart, LuHeartOff, LuPin } from 'react-icons/lu'
import { usePlaybackProgress } from '../../Contexts/PlaybackProgressContext'
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

const INACTIVE_PROGRESS_STYLE = { width: '0%' }

function ActiveSongProgress() {
  const { progress, duration } = usePlaybackProgress()
  const progressPercent = duration ? Math.min((progress / duration) * 100, 100) : 0

  return <div className="song-progress-fill" style={{ width: `${progressPercent}%` }} />
}

export const SongItemView = memo(function SongItemView({
  title,
  artist,
  shortViewCount,
  durationText,
  coverUrl,
  isActive = false,
  isPinned = false,
  isPinEnabled = false,
  isLiked = false,
  style,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel
}) {
  const menuRef = useRef(null)

  const handleContextMenu = (event) => {
    if (menuRef.current) {
      menuRef.current.open(event)
    }
  }

  return (
    <li
      className={isPinned ? 'visible is-pinned' : 'visible'}
      style={style}
      onClick={onPlay}
      onContextMenu={handleContextMenu}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
    >
      <div className={isActive ? 'songItem active' : 'songItem'}>
        <div
          className={[
            'songItem__pinIndicator',
            isPinned ? 'is-active' : '',
            isPinEnabled ? '' : 'is-hidden'
          ].filter(Boolean).join(' ')}
        >
          {isPinEnabled ? <LuPin /> : null}
        </div>

        <div className="song-progress">
          {isActive ? <ActiveSongProgress /> : <div className="song-progress-fill" style={INACTIVE_PROGRESS_STYLE} />}
        </div>
        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>
          <img src={coverUrl} loading="lazy" alt="" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{title}</span>
          <span className="song-artist">
            {artist || 'Unknow'} •{' '}
            <span className="song-views">
              <FaEye /> {shortViewCount}
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
  isPinned = false,
  isPinEnabled = false,
  isLiked = false,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel
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
      shortViewCount={file.short_view_count || 0}
      durationText={durationText}
      coverUrl={coverUrl}
      isActive={isActive}
      isPinned={isPinned}
      isPinEnabled={isPinEnabled}
      isLiked={isLiked}
      style={style}
      menuOptions={menuOptions}
      onPlay={() => onPlay?.(file, index)}
      onToggleLike={(event) => onToggleLike?.(event, file, isLiked)}
      onMenuSelect={(optionId) => onMenuSelect?.(optionId, file, index)}
      onPointerDown={(event) => onPointerDown?.(event, file, index)}
      onPointerUp={(event) => onPointerUp?.(event, file, index)}
      onPointerLeave={(event) => onPointerLeave?.(event, file, index)}
      onPointerCancel={(event) => onPointerCancel?.(event, file, index)}
    />
  )
}

function areSongItemViewPropsEqual(prevProps, nextProps) {
  return (
    prevProps.title === nextProps.title &&
    prevProps.artist === nextProps.artist &&
    prevProps.shortViewCount === nextProps.shortViewCount &&
    prevProps.durationText === nextProps.durationText &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.isPinEnabled === nextProps.isPinEnabled &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    prevProps.onPointerDown === nextProps.onPointerDown &&
    prevProps.onPointerUp === nextProps.onPointerUp &&
    prevProps.onPointerLeave === nextProps.onPointerLeave &&
    prevProps.onPointerCancel === nextProps.onPointerCancel &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

function areSongItemContainerPropsEqual(prevProps, nextProps) {
  return (
    prevProps.file === nextProps.file &&
    prevProps.index === nextProps.index &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.isPinEnabled === nextProps.isPinEnabled &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    prevProps.onPointerDown === nextProps.onPointerDown &&
    prevProps.onPointerUp === nextProps.onPointerUp &&
    prevProps.onPointerLeave === nextProps.onPointerLeave &&
    prevProps.onPointerCancel === nextProps.onPointerCancel &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

export const SongItem = memo(SongItemContainer, areSongItemContainerPropsEqual)
