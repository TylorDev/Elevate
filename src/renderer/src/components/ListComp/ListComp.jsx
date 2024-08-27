import './ListComp.scss'
import { useEffect } from 'react'

import { Cola } from '../Cola/Cola'
import { PlaylistActions } from '../PlaylistActions/PlaylistActions'
import { useSuper } from '../../Contexts/SupeContext'
import { useLikes } from '../../Contexts/LikeContext'
import { useParams } from 'react-router-dom'

function ListComp({ dataKey, fetchFunction, listName, useHook = useSuper }) {
  const { [dataKey]: list, [fetchFunction]: fetchList } = useHook()
  const { dir } = useParams()
  const { handleResume } = useSuper()
  useEffect(() => {
    if (fetchList) {
      fetchList()
    }
  }, [])

  useEffect(() => {
    if (dir === 'resume' && list?.length > 0) {
      console.log('lista cargada!')
      handleResume(list)
    }
  }, [list, dir])

  return (
    <div className="default-class">
      <h1>
        numero de elementos en {listName}: {list?.length}
      </h1>
      <PlaylistActions name={listName} />
      <h1>{listName}</h1>
      <Cola list={list} name={listName} />
    </div>
  )
}

export default ListComp
