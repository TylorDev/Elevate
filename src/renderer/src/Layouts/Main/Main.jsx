import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import './Main.scss'
import { Outlet } from 'react-router-dom'

import { useSuper } from '../../Contexts/SupeContext'
import Cola from '../../components/Cola/Cola'

function Main() {
  const { scrollRef, queueState } = useSuper()

  return (
    <div className="Main">
      <Header />
      {/* <button className="button" onClick={() => changeColor('#ffff')}>
        Cambiar a Rojo
      </button> */}
      <div className="outlet" ref={scrollRef}>
        <Outlet />
      </div>
      <div className="queue-panel">
        <Cola list={queueState.currentQueue} name={'currentQueue'} />
      </div>
      <AudioPlayer />
      <ToastContainer />
    </div>
  )
}
export default Main
