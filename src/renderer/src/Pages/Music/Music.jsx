import './Music.scss'

import { Cola } from '../../Components/Cola/Cola'

import { useSuper } from '../../Contexts/SupeContext'
import { CurrentPlaying } from './../Feed/CurrentPlaying'
import { useState } from 'react'
import { Button } from '../../Components/Button/Button'
import { Box, Drawer } from '@mui/material'
import { LuListVideo } from 'react-icons/lu'

function Music() {
  const { queueState } = useSuper()
  const [open, setOpen] = useState(false)

  const toggleDrawer = (newOpen) => () => {
    setOpen(newOpen)
  }

  return (
    <div className={`Music ${open ? 'cola-open' : 'cola-close'}`}>
      <div className="reproductor">
        <CurrentPlaying />
      </div>
      <div className="reprod-cola">
        <Cola list={queueState.currentQueue} name={'favourites'} />
      </div>
      <Button className="btn-cola" onClick={toggleDrawer(true)}>
        <LuListVideo />
      </Button>
      <div className="drawer">
        <Drawer open={open} onClose={toggleDrawer(false)} anchor={'right'}>
          <div className="reprod-cola">
            <Cola list={queueState.currentQueue} name={'favourites'} />
          </div>
        </Drawer>
      </div>
    </div>
  )
}
export default Music
