import { memo, useCallback, useMemo, useState } from 'react'
import { FixedSizeList } from 'react-window'
import { useSuper } from '../../Contexts/SupeContext'
import { Button } from '../Button/Button'
import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'
import './VirtualizedCola.scss'

const ROW_HEIGHT = 65
const LOAD_MORE_THRESHOLD = 12

const VirtualSongRow = memo(function VirtualSongRow({ index, style, data }) {
  const file = data.songs[index]

  if (!file) {
    return (
      <div style={style} className="VirtualizedCola__loader">
        Loading more tracks...
      </div>
    )
  }

  return (
    <SongItem
      style={style}
      file={file}
      index={index}
      cola={data.queue}
      name={data.name}
      filePath={data.filePath}
      padreActions={data.actions}
    />
  )
})

export function VirtualizedCola({
  list = [],
  name = 'tracks',
  filePath = null,
  actions,
  hasMore = false,
  isLoading = false,
  onLoadMore
}) {
  const { isShuffled } = useSuper()
  const [isDescending, setIsDescending] = useState(true)

  const sortedSongs = useMemo(() => {
    if (isShuffled) return list

    return [...list].sort((a, b) =>
      isDescending ? b.play_count - a.play_count : a.play_count - b.play_count
    )
  }, [isDescending, isShuffled, list])

  const itemData = useMemo(
    () => ({
      actions,
      filePath,
      name,
      queue: sortedSongs,
      songs: sortedSongs
    }),
    [actions, filePath, name, sortedSongs]
  )

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }) => {
      const shouldLoadMore =
        hasMore && !isLoading && visibleStopIndex >= sortedSongs.length - LOAD_MORE_THRESHOLD

      if (shouldLoadMore) {
        onLoadMore?.()
      }
    },
    [hasMore, isLoading, onLoadMore, sortedSongs.length]
  )

  const itemCount = sortedSongs.length + (hasMore ? 1 : 0)

  return (
    <div className="Cola VirtualizedCola">
      <Button className="Decendente" onClick={() => setIsDescending((value) => !value)}>
        {isDescending ? 'Orden Ascendente' : 'Orden Descendente'}
      </Button>

      {itemCount > 0 ? (
        <FixedSizeList
          className="VirtualizedCola__list"
          height={Math.max(window.innerHeight - 190, 320)}
          itemCount={itemCount}
          itemData={itemData}
          itemKey={(index, data) => data.songs[index]?.filePath || `loader-${index}`}
          itemSize={ROW_HEIGHT}
          onItemsRendered={handleItemsRendered}
          overscanCount={8}
          width="100%"
        >
          {VirtualSongRow}
        </FixedSizeList>
      ) : (
        <div className="VirtualizedCola__empty">
          {isLoading ? 'Loading tracks...' : 'No tracks found.'}
        </div>
      )}
    </div>
  )
}

export default VirtualizedCola
