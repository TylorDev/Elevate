import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import StatusBar from '../../components/StatusBar/StatusBar'
import './Main.scss'
import { Outlet } from 'react-router-dom'
import { useState } from 'react'

import { useSuper } from '../../Contexts/SupeContext'
import QueueTabsPanel from '../../components/QueueTabsPanel/QueueTabsPanel'

function Main() {
  const { scrollRef } = useSuper()
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isQueueHidden, setIsQueueHidden] = useState(false)

  const mainClassName = [
    'Main',
    isHeaderHidden ? 'Main--header-hidden' : '',
    isQueueHidden ? 'Main--queue-hidden' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={mainClassName}>
      <Background />
      <div className="Main__status">
        <StatusBar
          isHeaderHidden={isHeaderHidden}
          isQueueHidden={isQueueHidden}
          onToggleHeader={() => setIsHeaderHidden((current) => !current)}
          onToggleQueue={() => setIsQueueHidden((current) => !current)}
        />
      </div>
      {!isHeaderHidden ? (
        <aside className="Main__header">
          <Header />
        </aside>
      ) : null}
      <main className="outlet" ref={scrollRef}>
        <Outlet />
      </main>
      <div className="Main__player">
        <AudioPlayer />
      </div>
      {!isQueueHidden ? (
        <aside className="Main__queue">
          <QueueTabsPanel />
        </aside>
      ) : null}
      <ToastContainer />
    </div>
  )
}
export default Main
