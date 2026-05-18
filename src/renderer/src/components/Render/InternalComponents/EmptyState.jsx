import './InternalComponents.scss'

function EmptyState({ icon: Icon, title, description, className = '', compact = true }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`.trim()}>
      {Icon ? (
        <div className="empty-state__icon-wrap">
          <Icon className="empty-icon" />
        </div>
      ) : null}
      <div className="empty-state__copy">
        {title ? <p>{title}</p> : null}
        {description ? <small>{description}</small> : null}
      </div>
    </div>
  )
}

export default EmptyState
