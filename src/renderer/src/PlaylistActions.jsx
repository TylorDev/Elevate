import { useAppContext } from './Contexts/AppContext'
import './PlaylistActions.scss'

export function PlaylistActions() {
  const { selectFiles, handleSaveClick, openM3U, detectM3U, cola } = useAppContext()

  return (
    <div className="PlaylistActions">
      <button onClick={selectFiles}>Select Files</button>
      <button
        onClick={() => {
          handleSaveClick(cola)
        }}
      >
        Save
      </button>
      <button onClick={openM3U}>cargar lista</button>
      <button onClick={detectM3U}>Detectar lista</button>
    </div>
  )
}
