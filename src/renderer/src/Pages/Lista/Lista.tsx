import './Lista.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from '../../Components/Cola/Cola'

import { PlaylistActions } from '../../Components/PlaylistActions/PlaylistActions'

import { useMini } from '../../Contexts/MiniContext'
usePlaylists
function Lista() {
  const {
    lista, // lista personalizada
    eliminarElemento
  } = useMini()
  const actions = {
    'Remove from  the queue': (file) => {
      console.log('eliminando a ', file.fileName)
      eliminarElemento(file)
    }
  }
  return (
    <>
      <PlaylistActions />
      <Cola list={lista} name={'tracks'} actions={actions} />
    </>
  )
}
export default Lista
