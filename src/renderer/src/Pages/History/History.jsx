import './History.scss'

import ListComp from '../../Components/ListComp/ListComp'

function History() {
  return (
    <ListComp
      dataKey="history"
      fetchFunction="getHistory"
      className="History"
      listName="Historial"
    />
  )
}
export default History
