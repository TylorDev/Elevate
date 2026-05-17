import React from 'react'
import { LuPencil, LuTrash2 } from 'react-icons/lu'

function ListItem({ list, associationCount, isUnrelated, onDelete, onEdit, onSelect }) {
  const presetCount = Array.isArray(list?.presetNames) ? list.presetNames.length : 0

  return (
    <button type="button" onClick={onSelect}>
      <div>
        <div>
          <span>ListItem</span>
          <strong>{list?.name || 'Sin nombre'}</strong>
        </div>
        <span>{isUnrelated ? 'Unrelated' : 'Linked'}</span>
      </div>

      <div>
        <span>{presetCount} presets</span>
        <span>{associationCount} source links</span>
      </div>

      <div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(list)
          }}
        >
          <LuPencil /> Edit List Item
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(list)
          }}
        >
          <LuTrash2 /> Delete List Item
        </button>
      </div>
    </button>
  )
}

export default ListItem
