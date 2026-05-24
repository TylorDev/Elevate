import { LuFileMusic, LuFolder } from 'react-icons/lu'
import './ExploremItem.scss'

export function ExploremItem({
  entry,
  isSelected = false,
  isDisabled = false,
  onClick
}) {
  const isDirectory = entry?.entryType === 'directory'
  const className = [
    'explorem-item',
    isDirectory ? 'explorem-item--directory' : 'explorem-item--file',
    isSelected ? 'is-selected' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isDisabled}
      title={entry?.name || ''}
    >
      <span className="explorem-item__icon">
        {isDirectory ? <LuFolder /> : <LuFileMusic />}
      </span>
      <span className="explorem-item__name">{entry?.name || ''}</span>
    </button>
  )
}

export default ExploremItem
