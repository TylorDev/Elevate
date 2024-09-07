import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './PlaylistActions.scss'
import { useLikes } from './../../Contexts/LikeContext'
import { useSuper } from '../../Contexts/SupeContext'
import { useMini } from '../../Contexts/MiniContext'

export function PlaylistActions({ name }) {
  const { handleSaveClick } = useSuper()
  const { getLikes } = useLikes()
  const { addDirectory } = useMini()
  const { getSavedLists, openM3U, getAllSongs } = usePlaylists()

  return (
    <div className="PlaylistActions">
      <button onClick={addDirectory}>Select Files</button>
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
