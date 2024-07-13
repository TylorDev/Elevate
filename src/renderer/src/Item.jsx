/* eslint-disable react/prop-types */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export const Item = ({ id, file, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition, // transición predeterminada
    border: '1px solid white'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      [{index}]{file.fileName}
    </div>
  )
}
