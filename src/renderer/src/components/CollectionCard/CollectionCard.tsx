import './CollectionCard.scss'

function buildClassName(parts) {
  return parts.filter(Boolean).join(' ')
}

export function CollectionCard({
  icon = null,
  label,
  value,
  meta = null,
  variant = 'default',
  tone = 'acid',
  active = false,
  interactive = false,
  isEmpty = false,
  onClick,
  actionIcon = null,
  actionLabel = '',
  onActionClick,
  actionDisabled = false,
  actionLoading = false,
  className = '',
  as,
  backgroundImage = '',
  accentColor = '',
  accentContrastColor = '',
  ...props
}) {
  const isMini = variant === 'mini'
  const isInteractive = interactive || typeof onClick === 'function'
  const hasAction = !isMini && typeof onActionClick === 'function'
  const Component = hasAction ? 'div' : as || (isInteractive ? 'button' : 'div')
  const appliedTone = isEmpty ? 'neutral' : tone
  const mergedStyle = {
    ...(props.style || {}),
    ...(accentColor && !isEmpty ? { '--card-color': accentColor } : {}),
    ...(accentContrastColor && !isEmpty ? { '--card-accent-contrast': accentContrastColor } : {}),
    ...(!isMini && backgroundImage && !isEmpty
      ? { '--card-background-image': `url("${backgroundImage}")` }
      : {})
  }
  const componentProps = {
    className: buildClassName([
      'collection-card',
      isMini ? 'collection-card--mini' : '',
      `tone-${appliedTone}`,
      active ? 'is-active' : '',
      isEmpty ? 'is-empty' : '',
      isInteractive ? 'is-interactive' : '',
      hasAction ? 'has-action' : '',
      !isMini && backgroundImage ? 'has-media-background' : '',
      className
    ]),
    style: mergedStyle,
    ...(hasAction ? {} : props)
  }

  if (isInteractive && !hasAction) {
    componentProps.type = props.type || 'button'
    componentProps.onClick = onClick
  }

  if (hasAction) {
    const mainButtonProps = { ...props }
    delete mainButtonProps.style

    return (
      <Component {...componentProps}>
        <button
          {...mainButtonProps}
          className="collection-card__main"
          type={props.type || 'button'}
          onClick={onClick}
        >
          {icon ? <span className="collection-card__icon">{icon}</span> : null}
          <span className="collection-card__label">{label}</span>
          <strong className="collection-card__value">{value}</strong>
          {meta ? <span className="collection-card__meta">{meta}</span> : null}
        </button>
        <button
          className="collection-card__action"
          type="button"
          aria-label={actionLabel || `Play ${label}`}
          disabled={actionDisabled || actionLoading}
          aria-busy={actionLoading ? 'true' : undefined}
          onClick={(event) => {
            event.stopPropagation()
            onActionClick(event)
          }}
        >
          {actionIcon}
        </button>
      </Component>
    )
  }

  return (
    <Component {...componentProps}>
      {icon ? <span className="collection-card__icon">{icon}</span> : null}
      {!isMini ? <span className="collection-card__label">{label}</span> : null}
      {!isMini ? <strong className="collection-card__value">{value}</strong> : null}
      {!isMini && meta ? <span className="collection-card__meta">{meta}</span> : null}
    </Component>
  )
}

export default CollectionCard
