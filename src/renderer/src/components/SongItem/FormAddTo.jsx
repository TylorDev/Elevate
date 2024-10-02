import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './FormAddTo.scss'

export function FormAddTo({ file, addSong }) {
  const { playlists } = usePlaylists()

  return (
    <div className="FormAddTo">
      {playlists.map((item, index) => (
        <button
          onClick={() => {
            addSong(item.path, file)
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
