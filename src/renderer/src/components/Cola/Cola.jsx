import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'

import { useMemo } from 'react'

export function Cola({ list = [], name = 'tracks', filePath = null, actions }) {
  const memoizedSongs = useMemo(() => {
    return list.map((file, index) => (
      <SongItem
        key={index}
        file={file}
        index={index}
        cola={list}
        name={name}
        filePath={filePath}
        padreActions={actions}
      />
    ))
  }, [list, name, filePath, actions]) // Dependencias de useMemo

  return (
    <div className="Cola">
      {list && list.length > 0 ? <ul>{memoizedSongs}</ul> : <LoadingCola></LoadingCola>}
    </div>
  )
}

function LoadingCola() {
  return (
    <div className="Cola">
      <ul>
        <SongItem />
        <SongItem />
        <SongItem />
        <SongItem />
      </ul>
    </div>
  )
}
export default Cola
