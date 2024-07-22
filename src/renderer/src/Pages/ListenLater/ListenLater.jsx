import './ListenLater.scss'
import { Cola } from '../../Cola'
import { useAppContext } from '../../Contexts/AppContext'
import { useEffect } from 'react'

function ListenLater() {
  const { later, getlatersongs } = useAppContext()
  useEffect(() => {
    getlatersongs()
  }, [])
  return (
    <div className="ListenLater">
      <Cola list={later} name={'later'} />
    </div>
  )
}
export default ListenLater
