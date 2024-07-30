import './Favourites.scss'

import ListComp from '../../Components/ListComp/ListComp'

function Favourites() {
  return (
    <ListComp
      dataKey="likes"
      fetchFunction="getlikes"
      className="Favourites"
      listName="favoritas"
    />
  )
}
export default Favourites
