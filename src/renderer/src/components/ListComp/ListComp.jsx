import './ListComp.scss'
import { useEffect } from 'react'

import { useAppContext } from '../../Contexts/AppContext'

import { Cola } from '../Cola/Cola'
import { PlaylistActions } from '../PlaylistActions/PlaylistActions'

function ListComp({ dataKey, fetchFunction, listName }) {
  const { [dataKey]: list, [fetchFunction]: fetchList } = useAppContext()

  useEffect(() => {
    if (fetchList) {
      fetchList()
    }
  }, [])

  return (
    <div className="default-class">
      <h1>
        numero de elementos en {listName}: {list.length}
      </h1>
      <PlaylistActions name={listName} />
      <h1>{listName}</h1>
      <Cola list={list} name={listName} />
    </div>
  )
}

export default ListComp
