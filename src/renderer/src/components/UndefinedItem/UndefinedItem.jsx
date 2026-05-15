import { Link, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
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
  detailsTo,
  onDetailsClick,
  detailsLabel = 'Detalles',
  className = '',
  style,
  isLoading = false,
  loadingComponent
}) {
  const navigate = useNavigate()

  if (isLoading) {
    return loadingComponent || <div className="UndefinedItem loading">Loading...</div>
  }

  const mergedMenuOptions = useMemo(() => {
    if (!detailsTo && !onDetailsClick) {
      return menuOptions
    }

    return [
      { id: '__details__', label: detailsLabel },
      ...menuOptions
    ]
  }, [detailsLabel, detailsTo, menuOptions, onDetailsClick])

  const handleMenuAction = (optionId) => {
    if (optionId === '__details__') {
      if (onDetailsClick) {
        onDetailsClick()
        return
      }

      if (detailsTo) {
        navigate(detailsTo)
      }
      return
    }

    onMenuSelect?.(optionId)
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
      <div className="ui-cover-wrapper" onClick={onPlayClick || onTitleClick || undefined}>
        {typeof cover === 'string' ? (
          <img src={cover} alt={title} className="ui-cover-img" />
        ) : (
          <div className="ui-cover-icon">{cover}</div>
        )}
      </div>

      <div className="ui-info">
        {renderTitle()}
        <div className="ui-metadata">
          <span className="ui-subtitle">{subtitle}</span>
          {extraInfo && <span className="ui-extra">{extraInfo}</span>}
        </div>
      </div>

      <div className="ui-actions">
        {mergedMenuOptions.length > 0 && (
          <OverflowMenu
            options={mergedMenuOptions}
            onSelect={handleMenuAction}
          />
        )}
      </div>
    </li>
  )
}
