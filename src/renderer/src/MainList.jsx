/* eslint-disable react/prop-types */

import './Cola.scss'
import { useAppContext } from './Contexts/AppContext'
import { SongItem } from './SongItem'
export function MainList() {
  const { metadata } = useAppContext()
  return (
    <div className="Cola">
      {metadata && metadata.length > 0 ? (
        <ul>
          {metadata.map((file, index) => (
            <SongItem key={index} file={file} index={index} name={'tracks'} />
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
