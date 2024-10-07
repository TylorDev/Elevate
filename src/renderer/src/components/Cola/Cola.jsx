import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'

import { useMemo } from 'react'

export function Cola({ list = [], name = 'tracks', filePath = null, actions }) {
  // const validList = Array.isArray(list) ? list : [] // Verificar si list es un array

  // const memoizedSongs = useMemo(() => {
  // return validList.map((file, index) => (
  //   <SongItem
  //     key={index}
  //     file={file}
  //     index={index}
  //     cola={validList}
  //     name={name}
  //     filePath={filePath}
  //     padreActions={actions}
  //   />
  // ))
  // }, [validList, name, filePath, actions])

  return (
    <div className="Cola">
      {/* {validList && validList.length > 0 ? <ul>{memoizedSongs}</ul> : <LoadingCola></LoadingCola>} */}
      {list.length > 0 ? (
        <ul>
          {list.map((file, index) => (
            <SongItem
              key={index}
              file={file}
              index={index}
              cola={list}
              name={name}
              filePath={filePath}
              padreActions={actions}
            />
          ))}
        </ul>
      ) : (
        <LoadingCola></LoadingCola>
      )}
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
