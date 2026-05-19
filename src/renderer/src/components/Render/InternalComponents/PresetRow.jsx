import { LuMusic } from 'react-icons/lu'
import './InternalComponents.scss'

function PresetRow({
  active = false,
  actions = null,
  className = '',
  cover = null,
  index,
  indexMuted = false,
  isStatic = false,
  name,
  onClick,
  style
}) {
  const classNames = [
    'preset-item',
    active ? 'active' : '',
    isStatic ? 'is-static' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classNames}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick(event)
              }
            }
          : undefined
      }
      onClick={onClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="preset-info">
        {typeof index === 'number' ? (
          <span className={`preset-index ${indexMuted ? 'muted' : ''}`.trim()}>{index + 1}</span>
        ) : null}
        {cover ? (
          <img className="preset-cover" src={cover} alt="" aria-hidden="true" />
        ) : (
          <LuMusic className="preset-icon" />
        )}
        <span className="preset-name">{name}</span>
      </div>
      {actions ? <div className="preset-actions">{actions}</div> : null}
    </div>
  )
}

export default PresetRow
