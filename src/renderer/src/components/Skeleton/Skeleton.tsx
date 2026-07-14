import './Skeleton.scss'

export function Skeleton({ width, height, borderRadius, className = '' }) {
  const style = {
    width: width || '100%',
    height: height || '100%',
    borderRadius: borderRadius || '8px'
  }

  return (
    <div 
      className={`Skeleton-wrapper ${className}`} 
      style={style}
      aria-hidden="true"
    />
  )
}
