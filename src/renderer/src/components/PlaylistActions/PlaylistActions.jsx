import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './PlaylistActions.scss'
import { useLikes } from './../../Contexts/LikeContext'
import { useSuper } from '../../Contexts/SupeContext'

export function PlaylistActions({ name }) {
  const { handleSaveClick } = useSuper()
  const { getLikes } = useLikes()
  const { selectFiles, getSavedLists, openM3U, getAllSongs } = usePlaylists()

  return (
    <div className="PlaylistActions">
      <button onClick={selectFiles}>Select Files</button>
      <button onClick={getAllSongs}>getAllsongs</button>
      <button
        onClick={() => {
          handleSaveClick(name)
        }}
      >
        Save
      </button>
      <button onClick={getLikes}>lista likes</button>
      <button onClick={openM3U}>cargar lista</button>
      <button onClick={getSavedLists}>getm3ulists</button>
    </div>
  )
}
