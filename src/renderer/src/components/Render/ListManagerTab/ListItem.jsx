import React from 'react'
import { LuPencil, LuTrash2 } from 'react-icons/lu'

function ListItem({
  list,
  associationCount,
  isSelected,
  isUnrelated,
  onDelete,
  onEdit,
  onSelect
}) {
  const presetCount = Array.isArray(list?.presetNames) ? list.presetNames.length : 0

  return (
    <div
      className={`list-manager-item ${isSelected ? 'is-selected' : ''}`.trim()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="list-manager-item__main">
        <div className="list-manager-item__title-group">
          <span className="list-manager-item__eyebrow">Preset List</span>
          <strong className="list-manager-item__title">{list?.name || 'Sin nombre'}</strong>
        </div>
        <span
          className={`list-manager-item__status ${isUnrelated ? 'is-unrelated' : 'is-linked'}`.trim()}
        >
          {isUnrelated ? 'Unrelated' : 'Linked'}
        </span>
      </div>

      <div className="list-manager-item__meta">
        <span>{presetCount} presets</span>
        <span>{associationCount} source links</span>
      </div>

      <div className="list-manager-item__actions">
        <button
          className="list-manager-item__action"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(list)
          }}
        >
          <LuPencil /> Edit
        </button>
        <button
          className="list-manager-item__action is-danger"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(list)
          }}
        >
          <LuTrash2 /> Delete
        </button>
      </div>
    </div>
  )
}

export default ListItem
