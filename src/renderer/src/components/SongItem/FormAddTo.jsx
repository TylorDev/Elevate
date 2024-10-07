import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './FormAddTo.scss'

export function FormAddTo({ file }) {
  const { playlists, addSongToList } = usePlaylists()

  return (
    <div
      className="FormAddTo"
      onClick={(event) => {
        event.stopPropagation() // Detiene la propagación del click
      }}
    >
      {playlists.map((item, index) => (
        <button
          onClick={(event) => {
            event.stopPropagation() // Detiene la propagación del click
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
