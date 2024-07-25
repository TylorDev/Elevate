import './AllTracks.scss'
import { Cola } from '../../Cola'
import { useAppContext } from '../../Contexts/AppContext'

function AllTracks() {
  const { metadata } = useAppContext()

  return (
    <div className="ListenLater">
      <Cola list={metadata} name={'meta'} />
    </div>
  )
}
export default AllTracks
