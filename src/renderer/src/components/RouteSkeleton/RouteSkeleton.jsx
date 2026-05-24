import { Skeleton } from '../Skeleton/Skeleton'
import './RouteSkeleton.scss'

function RouteSkeletonRow({ widths = [] }) {
  return (
    <div className="route-skeleton__row" aria-hidden="true">
      <Skeleton width="56px" height="56px" borderRadius="16px" />
      <div className="route-skeleton__row-copy">
        {widths.map((width) => (
          <Skeleton key={width} width={width} height="12px" />
        ))}
      </div>
      <Skeleton width="88px" height="34px" borderRadius="999px" />
    </div>
  )
}

export function RouteSkeleton() {
  return (
    <section className="route-skeleton" aria-busy="true" aria-live="polite">
      <div className="route-skeleton__hero">
        <div className="route-skeleton__hero-copy">
          <Skeleton width="108px" height="12px" />
          <Skeleton width="240px" height="38px" borderRadius="14px" />
          <Skeleton width="68%" height="14px" />
        </div>
        <div className="route-skeleton__hero-actions">
          <Skeleton width="132px" height="40px" borderRadius="999px" />
          <Skeleton width="96px" height="40px" borderRadius="999px" />
        </div>
      </div>

      <div className="route-skeleton__metrics" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="route-skeleton__metric-card">
            <Skeleton width="24px" height="24px" borderRadius="999px" />
            <Skeleton width="72px" height="12px" />
            <Skeleton width="110px" height="28px" borderRadius="12px" />
          </div>
        ))}
      </div>

      <div className="route-skeleton__panel">
        <div className="route-skeleton__panel-header">
          <Skeleton width="148px" height="18px" />
          <Skeleton width="84px" height="12px" />
        </div>
        <div className="route-skeleton__panel-list">
          <RouteSkeletonRow widths={['42%', '64%']} />
          <RouteSkeletonRow widths={['55%', '78%']} />
          <RouteSkeletonRow widths={['48%', '58%']} />
          <RouteSkeletonRow widths={['62%', '44%']} />
        </div>
      </div>
    </section>
  )
}

export default RouteSkeleton
