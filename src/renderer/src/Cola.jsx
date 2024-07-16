/* eslint-disable react/prop-types */

import './Cola.scss'
import { useAppContext } from './Contexts/AppContext'

export function Cola({ name }) {
  const { metadata, handleSongClick, currentIndex, addItemToEmptyList, handleGetBPMClick } =
    useAppContext()
  return (
    <div className="Cola">
      {metadata && metadata.length > 0 ? (
        <ul>
          {metadata.map((file, index) => (
            <SongItem
              key={index}
              file={file}
              index={index}
              currentIndex={currentIndex}
              handleSongClick={handleSongClick}
              add={addItemToEmptyList}
              getbpm={handleGetBPMClick}
              name={name}
            />
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}

function SongItem({ file, index, currentIndex, handleSongClick, add, getbpm, name }) {
  return (
    <li
      key={index}
      className={index === currentIndex ? 'active' : ''}
      onClick={() => handleSongClick(file, index, name)}
    >
      <span>{file.fileName}</span>
      <span>
        {Math.floor(file.duration / 60)}:
        {Math.floor(file.duration % 60)
          .toString()
          .padStart(2, '0')}
      </span>

      <button onClick={() => add(file)}> + </button>
      <button onClick={() => getbpm(file)}> getbpm </button>
    </li>
  )
}

const MusicControls = ({ file }) => {
  const handleAddToQueue = () => {
    console.log(`Agregar a la cola: ${file.filePath}`)
  }

  const handlePlay = () => {
    console.log(`Play: ${file.filePath}`)
  }

  const handleNext = () => {
    console.log(`Reproducir siguiente: ${file.filePath}`)
  }

  return (
    <div>
      <button onClick={handleAddToQueue}>Agregar a la cola</button>
      <button onClick={handlePlay}>Play</button>
      <button onClick={handleNext}>Reproducir siguiente</button>
    </div>
  )
}

export default MusicControls
