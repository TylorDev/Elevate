import './ListenLater.scss'
import ListComp from '../../Components/ListComp/ListComp'
import { useMini } from '../../Contexts/MiniContext'

function ListenLater() {
  return (
    <ListComp
      dataKey="later"
      fetchFunction="getlatersongs"
      className="ListenLater"
      listName="Escuchar mas tarde"
      useHook={useMini}
    />
  )
}
export default ListenLater
