import './Favourites.scss'
import { Cola } from './../../Cola'
import { useAppContext } from '../../Contexts/AppContext'
import { useEffect } from 'react'

function Favourites() {
  const { likes, getlikes } = useAppContext()
  useEffect(() => {
    getlikes()
  }, [])
  return (
    <div className="Favourites">
      <Cola list={likes} name={'fav'} />
    </div>
  )
}
export default Favourites
