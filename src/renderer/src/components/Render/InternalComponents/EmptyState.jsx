import './InternalComponents.scss'

function EmptyState({ icon: Icon, title, description, className = '', compact = true }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`.trim()}>
      {Icon ? <Icon className="empty-icon" /> : null}
      {title ? <p>{title}</p> : null}
      {description ? <small>{description}</small> : null}
    </div>
  )
}

export default EmptyState
