import './InternalComponents.scss'

function TabCard({
  className = '',
  eyebrow,
  icon: Icon,
  title,
  description,
  actions = null,
  children
}) {
  return (
    <article className={`manager-card ${className}`.trim()}>
      {(eyebrow || title || description || actions) && (
        <div className="manager-card__header tab-card__header">
          <div className="tab-card__header-top">
            <div className="tab-card__copy">
              {eyebrow && (
                <span className="config-label">
                  {Icon ? <Icon /> : null}
                  {eyebrow}
                </span>
              )}
              {title ? <h3 className="tab-card__title">{title}</h3> : null}
              {description ? <small className="tab-card__description">{description}</small> : null}
            </div>
            {actions}
          </div>
        </div>
      )}
      {children}
    </article>
  )
}

export default TabCard
