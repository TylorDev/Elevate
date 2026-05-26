import { Link, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { LuInfo } from 'react-icons/lu'
import { useI18n } from '../../Contexts/I18nContext'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import './UndefinedItem.scss'

export function UndefinedItem({
  cover,
  title,
  subtitle,
  extraInfo,
  metaBadge,
  onTitleClick,
  onPlayClick,
  menuOptions = [],
  onMenuSelect,
  to,
  detailsTo,
  onDetailsClick,
  detailsLabel,
  className = '',
  style,
  isLoading = false,
  loadingComponent
}) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const resolvedDetailsLabel = detailsLabel || t('common.details')

  if (isLoading) {
    return loadingComponent || <div className="UndefinedItem loading">Loading...</div>
  }

  const mergedMenuOptions = useMemo(() => {
    if (!detailsTo && !onDetailsClick) {
      return menuOptions
    }

    return [
      { id: '__details__', label: resolvedDetailsLabel, icon: <LuInfo /> },
      ...menuOptions
    ]
  }, [detailsTo, menuOptions, onDetailsClick, resolvedDetailsLabel])

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
          {(extraInfo || metaBadge) && (
            <span className="ui-extra">
              {extraInfo ? <span className="ui-extra-text">{extraInfo}</span> : null}
              {metaBadge ? <span className="ui-badge">{metaBadge}</span> : null}
            </span>
          )}
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
