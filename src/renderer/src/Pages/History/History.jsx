import './History.scss'
import { Cola } from '../../Cola'
import { useAppContext } from '../../Contexts/AppContext'
import { useEffect } from 'react'

function History() {
  const { history, getHistory } = useAppContext()
  useEffect(() => {
    getHistory()
  }, [])
  return (
    <div className="History">
      <Cola list={history} name={'later'} />
    </div>
  )
}
export default History
