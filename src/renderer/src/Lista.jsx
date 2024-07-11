/* eslint-disable react/prop-types */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

const Item = ({ id, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: '1px solid white'
  }

  const getFileName = (path) => {
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      [{index}]{getFileName(id)}
    </div>
  )
}

const Lista = ({ items, save }) => {
  const [currentItems, setCurrentItems] = useState(items)

  useEffect(() => {
    setCurrentItems(items)
  }, [items])

  useEffect(() => {
    save(currentItems)
  }, [currentItems])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setCurrentItems((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={currentItems}>
        {currentItems.map((item, index) => (
          <Item key={item} id={item} index={index} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

export default Lista
