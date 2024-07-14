import './PlaylistActions.scss'

export function PlaylistActions({ selectFiles, handleSaveClick, openM3U, detectM3U, paths }) {
  return (
    <div className="PlaylistActions">
      <button onClick={selectFiles}>Select Files</button>
      <button
        onClick={() => {
          handleSaveClick(paths)
        }}
      >
        Save
      </button>
      <button onClick={openM3U}>cargar lista</button>
      <button onClick={detectM3U}>Detectar lista</button>
    </div>
  )
}
