/* eslint-disable react/prop-types */

import './Cola.scss'

import { SongItem } from './SongItem'

export function Cola({ list }) {
  return (
    <div className="Cola">
      {list && list.length > 0 ? (
        <ul>
          {list.map((file, index) => (
            <SongItem key={index} file={file} index={index} cola={list} />
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
