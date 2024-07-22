import { useAppContext } from './Contexts/AppContext'

export function SongItem({ file, index, name }) {
  const {
    currentIndex,
    handleSongClick,
    addItemToEmptyList,
    handleGetBPMClick,

    likesong,
    unlikesong
  } = useAppContext()

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

      <button onClick={() => addItemToEmptyList(file)}> + </button>
      <button onClick={() => handleGetBPMClick(file)}> getbpm </button>
      <button onClick={() => likesong(file)}> like song </button>
      <button onClick={() => unlikesong(file)}> dislike song </button>
    </li>
  )
}
