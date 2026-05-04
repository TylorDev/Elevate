import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import './Main.scss'
import { Outlet } from 'react-router-dom'

import { useSuper } from '../../Contexts/SupeContext'
import QueueTabsPanel from '../../components/QueueTabsPanel/QueueTabsPanel'

function Main() {
  const { scrollRef } = useSuper()

  return (
    <div className="Main">
      <Background />
      <Header />
      {/* <button className="button" onClick={() => changeColor('#ffff')}>
        Cambiar a Rojo
      </button> */}
      <div className="outlet" ref={scrollRef}>
        <Outlet />
      </div>
      <QueueTabsPanel />
      <AudioPlayer />
      <ToastContainer />
    </div>
  )
}
export default Main
