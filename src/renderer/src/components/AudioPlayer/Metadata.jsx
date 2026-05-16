import { useNavigate } from 'react-router-dom'
import { LuHeart, LuHeartOff } from 'react-icons/lu'

import './Metadata.scss'

import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useLikes } from '../../Contexts/LikeContext'

export function Metadata() {
  const { currentFile } = useSuper()
  const navigate = useNavigate()
  const { currentCover } = usePlaylists()
  const { likeState, toggleLike } = useLikes()

  const title = currentFile?.title || currentFile?.fileName || 'Unknown'
  const artist = currentFile?.artist || 'Unknown'
  const shortViews = Number(currentFile?.short_view_count) || 0
  const skips = Number(currentFile?.skip_count) || 0

  const handleLikeClick = (event) => {
    event.stopPropagation()
    toggleLike(currentFile)
  }

  return (
    <div
      className="metadata"
      id="metadata"
      onClick={() => {
        if (currentFile) navigate('/music')
      }}
    >
      <div className="cover">
        <img src={currentCover || undefined} alt="sin cover" />
      </div>
      <div className="data">
        <div className="data-tittle">{title}</div>
        <div className="data-artist">{artist}</div>
        <div className="data-metrics" aria-label="Metricas de reproduccion">
          <span className="data-metric-pill">
            <strong>{shortViews}</strong>
            <small>Cortas</small>
          </span>
          <span className="data-metric-pill">
            <strong>{skips}</strong>
            <small>Skips</small>
          </span>
        </div>
      </div>
      <button
        className={likeState.currentLike ? 'metadata-like liked' : 'metadata-like'}
        onClick={handleLikeClick}
        aria-label={likeState.currentLike ? 'Remove like' : 'Like song'}
        disabled={!currentFile}
      >
        {likeState.currentLike ? <LuHeart /> : <LuHeartOff />}
      </button>
    </div>
  )
}
