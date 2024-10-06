import { useEffect } from 'react'

import './Playlists.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'

import { PlaylistItem } from './PlaylistItem'
import { PlaylistActions } from '../../Components/PlaylistActions/PlaylistActions'

function Playlists() {
  const { getSavedLists, playlists, addPlaylisthistory, updateArrayAlbums } = usePlaylists()

  useEffect(() => {
    if (!playlists || playlists.length === 0) {
      getSavedLists()
    }

    updateArrayAlbums(playlists)
  }, [])

  if (playlists.length === 0) {
    return (
      <div className="Playlists">
        <PlaylistActions />
        <ul>
          <PlaylistItem></PlaylistItem>
          <PlaylistItem></PlaylistItem>
          <PlaylistItem></PlaylistItem>
          <PlaylistItem></PlaylistItem>
          <PlaylistItem></PlaylistItem>
        </ul>
      </div>
    )
  }

  return (
    <div className="Playlists">
      <PlaylistActions />
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
