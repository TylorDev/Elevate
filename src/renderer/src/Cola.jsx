/* eslint-disable react/prop-types */

import './Cola.scss'
import { useAppContext } from './Contexts/AppContext'
import { SongItem } from './SongItem'

export function Cola() {
  const { emptyList } = useAppContext()
  return (
    <div className="Cola">
      {emptyList && emptyList.length > 0 ? (
        <ul>
          {emptyList.map((file, index) => (
            <SongItem key={index} file={file} index={index} name={'cola'} />
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
