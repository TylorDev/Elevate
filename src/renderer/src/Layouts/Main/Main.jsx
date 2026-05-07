import { lazy, Suspense } from 'react'
import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import './Main.scss'
import { Outlet } from 'react-router-dom'

import { useSuper } from '../../Contexts/SupeContext'

// Lazy-loaded: not needed for first paint
const QueueTabsPanel = lazy(() => import('../../components/QueueTabsPanel/QueueTabsPanel'))
const SearchBar = lazy(() => import('../../Components/SearchBar/SearchBar'))

function Main() {
  const { scrollRef } = useSuper()

  return (
    <div className="Main">
      <Background />
      <aside className="Main__header">
        <Header />
      </aside>
      <div className="Main__search">
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
      </div>
      <main className="outlet" ref={scrollRef}>
        <Outlet />
      </main>
      <div className="Main__player">
        <AudioPlayer />
      </div>
      <aside className="Main__queue">
        <Suspense fallback={null}>
          <QueueTabsPanel />
        </Suspense>
      </aside>
      <ToastContainer />
    </div>
  )
}
export default Main
