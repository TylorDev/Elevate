import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { PlaylistItem } from '../Playlists/PlaylistItem'
import './TopLists.scss'

export function TopLists() {
  const { playlists, addPlaylisthistory } = usePlaylists()
  return (
    <div className="tabs">
      {playlists.map((playlist, index) => (
        <PlaylistItem
          playlist={playlist}
          addPlaylisthistory={addPlaylisthistory}
          key={index}
          index={index}
        />
      ))}
    </div>
  )
}
