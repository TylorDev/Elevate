import { MiniStats } from './MiniStats'
import { CurrentPlaying } from './CurrentPlaying'
import { Aside } from './Aside'
import { RandomList } from './RandomList'
import { TopLists } from './TopLists'
import { Banner } from './Banner'
import './Feed.scss'

function Feed() {
  return (
    <div className="Feed">
      <RandomList />
      <CurrentPlaying />
      <TopLists />
      <Banner />
      <MiniStats />
      <Aside />
    </div>
  )
}
export default Feed
