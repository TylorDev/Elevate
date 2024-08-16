import './History.scss'

import ListComp from '../../Components/ListComp/ListComp'
import { useMini } from '../../Contexts/MiniContext'

function History() {
  return (
    <ListComp
      dataKey="history"
      fetchFunction="getHistory"
      className="History"
      listName="Historial"
      useHook={useMini}
    />
  )
}
export default History
