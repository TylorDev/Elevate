import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import SearchBar from '../../Components/SearchBar/SearchBar'
import './Main.scss'
import { Outlet } from 'react-router-dom'

import { useSuper } from '../../Contexts/SupeContext'
import QueueTabsPanel from '../../components/QueueTabsPanel/QueueTabsPanel'

function Main() {
  const { scrollRef } = useSuper()

  return (
    <div className="Main">
      <Background />
      <aside className="Main__header">
        <Header />
      </aside>
      <div className="Main__search">
        <SearchBar />
      </div>
      <main className="outlet" ref={scrollRef}>
        <Outlet />
      </main>
      <div className="Main__player">
        <AudioPlayer />
      </div>
      <aside className="Main__queue">
        <QueueTabsPanel />
      </aside>
      <ToastContainer />
    </div>
  )
}
export default Main
