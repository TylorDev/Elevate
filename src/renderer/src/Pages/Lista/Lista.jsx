import './Lista.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from '../../Components/Cola/Cola'

import { PlaylistActions } from '../../Components/PlaylistActions/PlaylistActions'

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
