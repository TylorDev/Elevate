import { Link } from 'react-router-dom'
import { FaPlay } from 'react-icons/fa'
import { Button } from '../Button/Button'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import './UndefinedItem.scss'

export function UndefinedItem({
  cover,
  title,
  subtitle,
  extraInfo,
  onTitleClick,
  onPlayClick,
  menuOptions = [],
  onMenuSelect,
  to,
  className = '',
  style,
  isLoading = false,
  loadingComponent
}) {
  if (isLoading) {
    return loadingComponent || <div className="UndefinedItem loading">Loading...</div>
  }

  const renderTitle = () => {
    if (to) {
      return (
        <Link to={to} className="ui-title">
          {title}
        </Link>
      )
    }
    return (
      <button type="button" className="ui-title" onClick={onTitleClick}>
        {title}
      </button>
    )
  }

  return (
    <li className={`UndefinedItem ${className}`} style={style}>
      <div className="ui-cover-wrapper" onClick={onTitleClick || undefined}>
        {typeof cover === 'string' ? (
          <img src={cover} alt={title} className="ui-cover-img" />
        ) : (
          <div className="ui-cover-icon">{cover}</div>
        )}
        <div className="ui-cover-overlay">
          <FaPlay className="ui-quick-play" />
        </div>
      </div>

      <div className="ui-info">
        {renderTitle()}
        <div className="ui-metadata">
          <span className="ui-subtitle">{subtitle}</span>
          {extraInfo && <span className="ui-extra">{extraInfo}</span>}
        </div>
      </div>

      <div className="ui-actions">
        {onPlayClick && (
          <Button className="ui-play-btn" onClick={onPlayClick}>
            <FaPlay />
          </Button>
        )}
        
        {menuOptions.length > 0 && (
          <OverflowMenu 
            options={menuOptions} 
            onSelect={onMenuSelect} 
          />
        )}
      </div>
    </li>
  )
}
