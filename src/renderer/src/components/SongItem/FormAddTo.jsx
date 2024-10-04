import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './FormAddTo.scss'

export function FormAddTo({ file }) {
  const { playlists, addSongToList } = usePlaylists()

  return (
    <div className="FormAddTo">
      {playlists.map((item, index) => (
        <button
          onClick={() => {
            addSongToList(item.path, file)
          }}
          key={index}
          className="fromItem"
        >
          agrega a {item.nombre}
        </button>
      ))}
    </div>
  )
}
