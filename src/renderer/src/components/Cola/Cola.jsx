import { useState } from 'react'
import { useSuper } from '../../Contexts/SupeContext'
import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'
import { Button } from '../Button/Button'

export function Cola({ list = [], name = 'tracks', filePath = null, actions }) {
  const { isShuffled } = useSuper()
  const [isDescending, setIsDescending] = useState(true) // Estado para controlar el orden

  // Función para cambiar el orden
  const toggleOrder = () => {
    setIsDescending(!isDescending)
  }
  return (
    <div className="Cola">
      <Button className="Decendente" onClick={toggleOrder}>
        {isDescending ? 'Orden Ascendente' : 'Orden Descendente'}
      </Button>
      {list.length > 0 ? (
        <ul>
          {(isShuffled
            ? list
            : list.slice().sort(
                (a, b) => (isDescending ? b.play_count - a.play_count : a.play_count - b.play_count) // Condición para cambiar entre ascendente y descendente
              )
          ).map((file, index) => (
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
