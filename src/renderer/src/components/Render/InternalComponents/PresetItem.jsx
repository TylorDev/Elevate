import { LuMusic } from 'react-icons/lu'
import './PresetItem.scss'

function PresetItem({
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
      <div className="preset-item__info">
        {typeof index === 'number' ? (
          <span className={`preset-item__index ${indexMuted ? 'muted' : ''}`.trim()}>
            {index + 1}
          </span>
        ) : null}
        {cover ? (
          <img className="preset-item__cover" src={cover} alt="" aria-hidden="true" />
        ) : (
          <LuMusic className="preset-item__icon" />
        )}
        <span className="preset-item__name">{name}</span>
      </div>
      {actions ? <div className="preset-item__actions">{actions}</div> : null}
    </div>
  )
}

export default PresetItem
