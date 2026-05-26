import { Skeleton } from '../Skeleton/Skeleton'
import './MusicRouteSkeleton.scss'

function MusicControlPill({ width = '42px', round = false }) {
  return (
    <div className="music-route-skeleton__control-pill" aria-hidden="true">
      <Skeleton
        width={width}
        height="42px"
        borderRadius={round ? '999px' : '10px'}
      />
    </div>
  )
}

export function MusicRouteSkeleton() {
  return (
    <section className="music-route-skeleton" aria-busy="true" aria-live="polite">
      <div className="music-route-skeleton__topbar">
        <div className="music-route-skeleton__controls">
          <MusicControlPill />
          <MusicControlPill />
          <MusicControlPill />
          <MusicControlPill width="132px" />
        </div>
        <MusicControlPill round />
      </div>

      <div className="music-route-skeleton__stage">
        <div className="music-route-skeleton__glow" aria-hidden="true" />
        <div className="music-route-skeleton__cover-frame">
          <Skeleton
            className="music-route-skeleton__cover"
            width="100%"
            height="100%"
            borderRadius="16px"
          />
        </div>
      </div>

      <div className="music-route-skeleton__footer">
        <div className="music-route-skeleton__preset-card">
          <Skeleton width="58%" height="14px" />
          <Skeleton width="36%" height="12px" />
        </div>

        <div className="music-route-skeleton__transport">
          <MusicControlPill round />
          <MusicControlPill round />
        </div>
      </div>
    </section>
  )
}

export default MusicRouteSkeleton
