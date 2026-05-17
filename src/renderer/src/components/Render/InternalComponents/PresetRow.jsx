import { LuMusic } from 'react-icons/lu'
import './InternalComponents.scss'

function PresetRow({
  active = false,
  actions = null,
  className = '',
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
    <div className={classNames} onClick={onClick} style={style}>
      <div className="preset-info">
        {typeof index === 'number' ? (
          <span className={`preset-index ${indexMuted ? 'muted' : ''}`.trim()}>{index + 1}</span>
        ) : null}
        <LuMusic className="preset-icon" />
        <span className="preset-name">{name}</span>
      </div>
      {actions ? <div className="preset-actions">{actions}</div> : null}
    </div>
  )
}

export default PresetRow
