/* eslint-disable react/prop-types */
import { useAppContext } from '../../Contexts/AppContext'
import { useLikes } from '../../Contexts/LikeContext'
import { useMini } from '../../Contexts/MiniContext'

export function SongItem({ file, index, cola }) {
  const {
    currentIndex,
    handleSongClick,

    handleGetBPMClick,
    addhistory
  } = useAppContext()

  const { removelatersong, latersong, addItemToEmptyList } = useMini()
  const { likesong, unlikesong } = useLikes()
  return (
    <li
      key={index}
      className={index === currentIndex ? 'active' : ''}
      onClick={() => handleSongClick(file, index, cola)}
    >
      <span>{file.fileName}</span>
      <span>
        {Math.floor(file.duration / 60)}:
        {Math.floor(file.duration % 60)
          .toString()
          .padStart(2, '0')}
      </span>
      <span>playcount:{file.play_count}</span>
      {/* <button onClick={() => addhistory(file)}> add to history </button>
      <button onClick={() => addItemToEmptyList(file)}> + </button>
      <button onClick={() => handleGetBPMClick(file)}> getbpm </button> */}
      <button onClick={() => likesong(file)}> like song </button>
      <button onClick={() => unlikesong(file)}> dislike song </button>
      {/* <button onClick={() => handleGetBPMClick(file)}> getbpm </button>
      <button onClick={() => latersong(file)}> later song </button>
      <button onClick={() => removelatersong(file)}> remove later song </button> */}
    </li>
  )
}
