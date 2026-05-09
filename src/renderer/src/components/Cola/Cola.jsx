import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FixedSizeList } from 'react-window'
import { useLikes } from '../../Contexts/LikeContext'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useSuper } from '../../Contexts/SupeContext'
import { DEFAULT_COVER, preloadCoverUrl } from '../../hooks/useCoverUrl'
import Modal from '../Modal/Modal'
import { FormAddTo } from '../SongItem/FormAddTo'
import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'
import './VirtualizedCola.scss'

const DEFAULT_ROW_HEIGHT = 65
const DEFAULT_VIRTUALIZATION_THRESHOLD = 100
const DEFAULT_OVERSCAN_COUNT = 8
const DEFAULT_MIN_HEIGHT = 320
const DEFAULT_VIEWPORT_OFFSET = 190
const LOAD_MORE_THRESHOLD = 12
const NON_VIRTUALIZED_COVER_LIMIT = 40

function getDefaultHeight() {
  return Math.max(window.innerHeight - DEFAULT_VIEWPORT_OFFSET, DEFAULT_MIN_HEIGHT)
}

function resolveListHeight(height) {
  if (typeof height === 'number' && Number.isFinite(height)) {
    return height
  }

  if (typeof height === 'string' && height.trim().endsWith('px')) {
    const parsedHeight = Number.parseInt(height, 10)

    if (Number.isFinite(parsedHeight)) {
      return parsedHeight
    }
  }

  return getDefaultHeight()
}

function areStylesEqual(prevStyle, nextStyle) {
  if (prevStyle === nextStyle) return true
  if (!prevStyle || !nextStyle) return !prevStyle && !nextStyle

  return (
    prevStyle.top === nextStyle.top &&
    prevStyle.left === nextStyle.left &&
    prevStyle.width === nextStyle.width &&
    prevStyle.height === nextStyle.height
  )
}

function getLikeValue(likesLookup, file) {
  if (!file?.filePath) {
    return false
  }

  if (likesLookup.has(file.filePath)) {
    return true
  }

  return Boolean(file.liked)
}

const VirtualSongRow = memo(function VirtualSongRow({ index, style, data }) {
  const file = data.songs[index]

  if (!file) {
    return (
      <div style={style} className="VirtualizedCola__loader">
        Loading more tracks...
      </div>
    )
  }

  const isActive = data.activeFilePath === file.filePath

  return (
    <SongItem
      style={style}
      file={file}
      index={index}
      coverUrl={data.coverUrls[file.filePath] || DEFAULT_COVER}
      isActive={isActive}
      progressPercent={isActive ? data.activeProgressPercent : 0}
      isLiked={getLikeValue(data.likesLookup, file)}
      menuOptions={data.menuOptions}
      onPlay={data.onPlay}
      onToggleLike={data.onToggleLike}
      onMenuSelect={data.onMenuSelect}
    />
  )
}, areVirtualRowsEqual)

function areVirtualRowsEqual(prevProps, nextProps) {
  if (prevProps.index !== nextProps.index || !areStylesEqual(prevProps.style, nextProps.style)) {
    return false
  }

  const prevFile = prevProps.data.songs[prevProps.index]
  const nextFile = nextProps.data.songs[nextProps.index]

  if (prevFile !== nextFile) {
    return false
  }

  if (!nextFile) {
    return true
  }

  const filePath = nextFile.filePath
  const wasActive = prevProps.data.activeFilePath === filePath
  const isActive = nextProps.data.activeFilePath === filePath

  if (wasActive !== isActive) {
    return false
  }

  if (isActive && prevProps.data.activeProgressPercent !== nextProps.data.activeProgressPercent) {
    return false
  }

  return (
    prevProps.data.coverUrls[filePath] === nextProps.data.coverUrls[filePath] &&
    getLikeValue(prevProps.data.likesLookup, prevFile) === getLikeValue(nextProps.data.likesLookup, nextFile) &&
    prevProps.data.menuOptions === nextProps.data.menuOptions &&
    prevProps.data.onPlay === nextProps.data.onPlay &&
    prevProps.data.onToggleLike === nextProps.data.onToggleLike &&
    prevProps.data.onMenuSelect === nextProps.data.onMenuSelect
  )
}

export function Cola({
  list = [],
  name = 'tracks',
  actions,
  virtualized,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  rowHeight = DEFAULT_ROW_HEIGHT,
  height,
  overscanCount = DEFAULT_OVERSCAN_COUNT,
  hasMore = false,
  isLoading = false,
  onLoadMore
}) {
  const { isShuffled, handleSongClick, currentFile, progress, duration } = useSuper()
  const { likesLookup, toggleLike } = useLikes()
  const { agregarElemento, latersong } = useMini()
  const { addPlaylisthistory } = usePlaylists()
  const [selectedPlaylistSong, setSelectedPlaylistSong] = useState(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, stop: -1 })
  const [coverUrls, setCoverUrls] = useState({})
  const isDescending = true

  const sortedList = useMemo(() => {
    if (isShuffled) return list

    return list
      .slice()
      .sort((a, b) => (isDescending ? b.play_count - a.play_count : a.play_count - b.play_count))
  }, [isDescending, isShuffled, list])

  const shouldVirtualize =
    typeof virtualized === 'boolean'
      ? virtualized
      : sortedList.length >= virtualizationThreshold

  const activeFilePath = currentFile?.filePath ?? null
  const activeProgressPercent =
    activeFilePath && duration ? Math.min((progress / duration) * 100, 100) : 0

  const menuOptions = useMemo(() => {
    const options = [
      { id: 'add to queue', label: 'Add to queue' },
      { id: 'add later', label: 'Add later' },
      { id: 'add to playlist', label: 'Add to playlist' }
    ]

    if (actions) {
      Object.keys(actions).forEach((key) => {
        options.push({ id: key, label: key })
      })
    }

    return options
  }, [actions])

  const onPlay = useCallback(
    (file, index) => {
      handleSongClick(file, index, sortedList, name)

      if (name && !name.startsWith('folder:') && !name.startsWith('/')) {
        addPlaylisthistory(name)
      }
    },
    [addPlaylisthistory, handleSongClick, name, sortedList]
  )

  const onToggleLike = useCallback(
    async (event, file, isLiked) => {
      event.stopPropagation()
      await toggleLike(file, isLiked, { refreshCollection: false })
    },
    [toggleLike]
  )

  const onMenuSelect = useCallback(
    (optionId, file, index) => {
      if (optionId === 'add to queue') {
        agregarElemento(file)
        return
      }

      if (optionId === 'add later') {
        latersong(file)
        return
      }

      if (optionId === 'add to playlist') {
        setSelectedPlaylistSong(file)
        return
      }

      const action = actions?.[optionId]
      if (action) {
        action(file, index)
      } else {
        console.log('OpciÃ³n no reconocida:', optionId)
      }
    },
    [actions, agregarElemento, latersong]
  )

  const handleItemsRendered = useCallback(
    ({ visibleStartIndex, visibleStopIndex }) => {
      setVisibleRange((currentRange) => {
        if (
          currentRange.start === visibleStartIndex &&
          currentRange.stop === visibleStopIndex
        ) {
          return currentRange
        }

        return {
          start: visibleStartIndex,
          stop: visibleStopIndex
        }
      })

      const shouldLoadMore =
        hasMore && !isLoading && visibleStopIndex >= sortedList.length - LOAD_MORE_THRESHOLD

      if (shouldLoadMore) {
        onLoadMore?.()
      }
    },
    [hasMore, isLoading, onLoadMore, sortedList.length]
  )

  const visibleSongs = useMemo(() => {
    if (sortedList.length === 0) {
      return []
    }

    if (!shouldVirtualize) {
      return sortedList.slice(0, NON_VIRTUALIZED_COVER_LIMIT)
    }

    const start = Math.max(visibleRange.start - overscanCount, 0)
    const stop = Math.min(visibleRange.stop + overscanCount, sortedList.length - 1)

    if (stop < start) {
      return sortedList.slice(0, Math.min(sortedList.length, NON_VIRTUALIZED_COVER_LIMIT))
    }

    return sortedList.slice(start, stop + 1)
  }, [overscanCount, shouldVirtualize, sortedList, visibleRange.start, visibleRange.stop])

  useEffect(() => {
    let isMounted = true

    if (visibleSongs.length === 0) {
      return () => {
        isMounted = false
      }
    }

    Promise.all(
      visibleSongs.map(async (song) => ({
        filePath: song.filePath,
        url: await preloadCoverUrl(song.filePath, 'thumb')
      }))
    ).then((resolvedCovers) => {
      if (!isMounted) {
        return
      }

      setCoverUrls((currentCoverUrls) => {
        let hasChanges = false
        const nextCoverUrls = { ...currentCoverUrls }

        resolvedCovers.forEach(({ filePath, url }) => {
          if (nextCoverUrls[filePath] !== url) {
            nextCoverUrls[filePath] = url
            hasChanges = true
          }
        })

        return hasChanges ? nextCoverUrls : currentCoverUrls
      })
    })

    return () => {
      isMounted = false
    }
  }, [visibleSongs])

  const itemData = useMemo(
    () => ({
      activeFilePath,
      activeProgressPercent,
      coverUrls,
      likesLookup,
      menuOptions,
      onMenuSelect,
      onPlay,
      onToggleLike,
      songs: sortedList
    }),
    [
      activeFilePath,
      activeProgressPercent,
      coverUrls,
      likesLookup,
      menuOptions,
      onMenuSelect,
      onPlay,
      onToggleLike,
      sortedList
    ]
  )

  const itemCount = sortedList.length + (hasMore ? 1 : 0)
  const listHeight = resolveListHeight(height)

  return (
    <div className={shouldVirtualize ? 'Cola VirtualizedCola' : 'Cola'}>
      {itemCount > 0 ? (
        shouldVirtualize ? (
          <FixedSizeList
            className="VirtualizedCola__list"
            height={listHeight}
            itemCount={itemCount}
            itemData={itemData}
            itemKey={(index, data) => data.songs[index]?.filePath || `loader-${index}`}
            itemSize={rowHeight}
            onItemsRendered={handleItemsRendered}
            overscanCount={overscanCount}
            width="100%"
          >
            {VirtualSongRow}
          </FixedSizeList>
        ) : (
          <ul style={typeof height === 'string' ? { minHeight: height } : undefined}>
            {sortedList.map((file, index) => {
              const isActive = file.filePath === activeFilePath

              return (
                <SongItem
                  key={file.filePath || `${name}-${index}`}
                  file={file}
                  index={index}
                  coverUrl={coverUrls[file.filePath] || DEFAULT_COVER}
                  isActive={isActive}
                  progressPercent={isActive ? activeProgressPercent : 0}
                  isLiked={getLikeValue(likesLookup, file)}
                  menuOptions={menuOptions}
                  onPlay={onPlay}
                  onToggleLike={onToggleLike}
                  onMenuSelect={onMenuSelect}
                />
              )
            })}
          </ul>
        )
      ) : (
        <LoadingCola isLoading={isLoading} />
      )}

      {selectedPlaylistSong && (
        <Modal isVisible={Boolean(selectedPlaylistSong)} closeModal={() => setSelectedPlaylistSong(null)}>
          <FormAddTo file={selectedPlaylistSong} />
        </Modal>
      )}
    </div>
  )
}

function LoadingCola({ isLoading = false }) {
  if (!isLoading) {
    return <div className="VirtualizedCola__empty">No tracks found.</div>
  }

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
