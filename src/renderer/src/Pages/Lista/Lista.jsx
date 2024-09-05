import './Lista.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from '../../Components/Cola/Cola'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { PlaylistActions } from '../../Components/PlaylistActions/PlaylistActions'
import { useEffect } from 'react'
import { useMini } from '../../Contexts/MiniContext'
usePlaylists
function Lista() {
  const {
    lista // lista personalizada
  } = useMini()

  return (
    <>
      <PlaylistActions />
      <Cola list={lista} name={'tracks'} />
    </>
  )
}
export default Lista
