import { MiniStats } from './MiniStats'
import { CurrentPlaying } from './CurrentPlaying'
import { Aside } from './Aside'
import { RandomList } from './RandomList'
import { TopLists } from './TopLists'
import { Banner } from './Banner'
import './Feed.scss'
import { useSuper } from '../../Contexts/SupeContext'

function Feed() {
  const { isAwaken } = useSuper()
  console.log(isAwaken)
  return (
    <div className="Feed">
      {isAwaken ? (
        <>
          <RandomList />
          <CurrentPlaying />
          <TopLists />
          <Banner />
          <MiniStats />
          <Aside />
        </>
      ) : (
        <p>Cargando...</p>
      )}
    </div>
  )
}
export default Feed
