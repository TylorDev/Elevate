import './AllTracks.scss'

import ListComp from '../../Components/ListComp/ListComp'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
usePlaylists
function AllTracks() {
  return <ListComp dataKey="metadata" listName="tracks" useHook={usePlaylists} />
}
export default AllTracks
