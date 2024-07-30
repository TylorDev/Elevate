import './ListenLater.scss'
import ListComp from '../../Components/ListComp/ListComp'

function ListenLater() {
  return (
    <ListComp
      dataKey="later"
      fetchFunction="getlatersongs"
      className="ListenLater"
      listName="Escuchar mas tarde"
    />
  )
}
export default ListenLater
