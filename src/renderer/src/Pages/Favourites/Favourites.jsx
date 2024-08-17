import './Favourites.scss'

import ListComp from '../../Components/ListComp/ListComp'
import { useLikes } from '../../Contexts/LikeContext'

function Favourites() {
  return (
    <ListComp
      dataKey="likes"
      fetchFunction="getLikes"
      className="Favourites"
      listName="favoritas"
      useHook={useLikes}
    />
  )
}
export default Favourites
