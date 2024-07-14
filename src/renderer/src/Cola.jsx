/* eslint-disable react/prop-types */

import './Cola.scss'

export function Cola({ metadata, handleSongClick, currentIndex }) {
  return (
    <div className="Cola">
      {metadata && metadata.length > 0 ? (
        <ul>
          {metadata.map((file, index) => (
            <li
              key={index}
              className={index === currentIndex ? 'active' : ''}
              onClick={() => handleSongClick(file, index)}
            >
              {console.log(file)}
              <span>{file.fileName}</span>
              <span>
                {Math.floor(file.duration / 60)}:
                {Math.floor(file.duration % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
