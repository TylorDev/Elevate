import { useEffect } from 'react'

import './Playlists.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'

import { PlaylistItem } from './PlaylistItem'

function Playlists() {
  const { getSavedLists, playlists, addPlaylisthistory } = usePlaylists()

  useEffect(() => {
    if (!playlists || playlists.length === 0) {
      getSavedLists()
    }
  }, [])

  return (
    <div className="Playlists">
      <ul>
        {playlists.map((playlist, index) => (
          <PlaylistItem
            playlist={playlist}
            addPlaylisthistory={addPlaylisthistory}
            key={index}
            index={index}
          />
        ))}
      </ul>
    </div>
  )
}
export default Playlists
