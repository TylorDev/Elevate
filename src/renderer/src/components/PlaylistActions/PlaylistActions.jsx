import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './PlaylistActions.scss'

import { useSuper } from '../../Contexts/SupeContext'
import { Button } from '../Button/Button'

export function PlaylistActions({ name }) {
  const { handleSaveClick } = useSuper()

  const { openM3U } = usePlaylists()

  return (
    <div className="PlaylistActions">
      <button
        onClick={() => {
          handleSaveClick(name)
        }}
      >
        Save queue to Playlists
      </button>

      <button onClick={openM3U}>Upload list</button>
    </div>
  )
}
