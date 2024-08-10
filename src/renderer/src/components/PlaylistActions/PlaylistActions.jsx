import { useAppContext } from '../../Contexts/AppContext'
import './PlaylistActions.scss'

export function PlaylistActions({ name }) {
  const {
    selectFiles,
    handleSaveClick,
    openM3U,
    detectM3U,

    getlikes,

    getSavedLists,
    getAllSongs
  } = useAppContext()

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
      <button onClick={getlikes}>lista likes</button>
      <button onClick={openM3U}>cargar lista</button>
      <button onClick={detectM3U}>Detectar lista</button>

      <button onClick={getSavedLists}>getm3ulists</button>
    </div>
  )
}
