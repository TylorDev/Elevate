import { memo, useCallback, useMemo } from 'react'
import { FixedSizeList } from 'react-window'
import { useLikes } from '../../Contexts/LikeContext'
import { useSuper } from '../../Contexts/SupeContext'
import { SongItem } from '../SongItem/SongItem'
import './Cola.scss'
import './VirtualizedCola.scss'

const DEFAULT_ROW_HEIGHT = 65
const DEFAULT_VIRTUALIZATION_THRESHOLD = 100
const DEFAULT_OVERSCAN_COUNT = 8
const DEFAULT_MIN_HEIGHT = 320
const DEFAULT_VIEWPORT_OFFSET = 190
const LOAD_MORE_THRESHOLD = 12

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

function getLikeOverride(likesLookup, file) {
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
      cola={data.queue}
      name={data.name}
      padreActions={data.actions}
      isActive={isActive}
      progressPercent={isActive ? data.activeProgressPercent : 0}
      onSongClick={data.onSongClick}
      isLikedOverride={getLikeOverride(data.likesLookup, file)}
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

  if (
    prevProps.data.queue !== nextProps.data.queue ||
    prevProps.data.actions !== nextProps.data.actions ||
    prevProps.data.name !== nextProps.data.name ||
    prevProps.data.onSongClick !== nextProps.data.onSongClick
  ) {
    return false
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
    getLikeOverride(prevProps.data.likesLookup, prevFile) ===
    getLikeOverride(nextProps.data.likesLookup, nextFile)
  )
}

export function Cola({
  list = [],
  name = 'tracks',
  filePath = null,
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
  const { likesLookup } = useLikes()
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

  const onSongItemClick = useCallback(
    (file, index) => {
      handleSongClick(file, index, sortedList, name)
    },
    [handleSongClick, name, sortedList]
  )

  const itemData = useMemo(
    () => ({
      actions,
      activeFilePath,
      activeProgressPercent,
      likesLookup,
      name,
      onSongClick: onSongItemClick,
      queue: sortedList,
      songs: sortedList
    }),
    [actions, activeFilePath, activeProgressPercent, likesLookup, name, onSongItemClick, sortedList]
  )

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }) => {
      const shouldLoadMore =
        hasMore && !isLoading && visibleStopIndex >= sortedList.length - LOAD_MORE_THRESHOLD

      if (shouldLoadMore) {
        onLoadMore?.()
      }
    },
    [hasMore, isLoading, onLoadMore, sortedList.length]
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
                  cola={sortedList}
                  name={name}
                  filePath={filePath}
                  padreActions={actions}
                  isActive={isActive}
                  progressPercent={isActive ? activeProgressPercent : 0}
                  onSongClick={onSongItemClick}
                  isLikedOverride={getLikeOverride(likesLookup, file)}
                />
              )
            })}
          </ul>
        )
      ) : (
        <LoadingCola isLoading={isLoading} />
      )}
    </div>
  )
}

function LoadingCola({ isLoading = false }) {
  if (!isLoading) {
    return (
      <div className="VirtualizedCola__empty">
        No tracks found.
      </div>
    )
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
