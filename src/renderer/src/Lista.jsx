/* eslint-disable react/prop-types */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext } from '@dnd-kit/sortable'

const Item = ({ id, index, file, play }) => {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={console.log('click', file.size)}
    >
      [{index}]{getFileName(id)}/{file.size}/
    </div>
  )
}

const Lista = ({ save, files, handleSongClick, handleList }) => {
  const [currentItems, setCurrentItems] = useState([])
  const [metadata, setMetadata] = useState([])

  useEffect(() => {
    if (files && Array.isArray(files)) {
      const filePaths = files.map((file) => file.filePath)
      setCurrentItems(filePaths)
    }
    setMetadata(files || [])
  }, [files])

  // useEffect(() => {
  //   save(currentItems)
  //   handleList(metadata)
  // }, [currentItems, metadata])

  const handleDragEnd = (event) => {
    const { active, over } = event

    const index = metadata.findIndex((item) => item.filePath === active.id)

    console.log(index) // 2 (índice del objeto que coincide)

    handleSongClick(metadata[index], index)

    if (active.id !== over.id) {
      setCurrentItems((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })

      setMetadata((items) => {
        const oldIndex = items.findIndex((item) => item.filePath === active.id)
        const newIndex = items.findIndex((item) => item.filePath === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <h1>lista </h1>
      <SortableContext items={currentItems || []}>
        {(currentItems || []).map((item, index) => (
          <Item
            key={item}
            id={item}
            file={metadata[index]}
            index={index}
            handleSongClick={handleSongClick}
          />
        ))}
      </SortableContext>

      <h1>metadata</h1>
      {(metadata || []).map((item, index) => (
        <div className="div" key={item.filePath}>
          {item.fileName}/{item.size}
        </div>
      ))}
    </DndContext>
  )
}

export default Lista
