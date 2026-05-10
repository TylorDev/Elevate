import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FixedSizeList } from 'react-window'

const DEFAULT_MIN_HEIGHT = 240
const DEFAULT_LOADING_COUNT = 4
const LOAD_MORE_THRESHOLD = 4

const VirtualizedRow = memo(function VirtualizedRow({ index, style, data }) {
  if (data.hasMore && index >= data.items.length) {
    return <div style={style} className="VirtualizedCola__loader">Loading more...</div>
  }

  const item = data.items[index]
  return data.renderItem(item, index, style)
})

export function VirtualizedQueueEntityList({
  className = '',
  items = [],
  itemSize = 76,
  overscanCount = 6,
  itemKey,
  renderItem,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadingCount = DEFAULT_LOADING_COUNT,
  emptyState = null
}) {
  const containerRef = useRef(null)
  const [height, setHeight] = useState(DEFAULT_MIN_HEIGHT)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => {
      const nextHeight = Math.max(container.clientHeight || 0, DEFAULT_MIN_HEIGHT)
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    updateHeight()

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateHeight)
      return () => {
        window.removeEventListener('resize', updateHeight)
      }
    }

    const resizeObserver = new window.ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const displayItems = loading && items.length === 0 ? Array.from({ length: loadingCount }) : items

  const itemData = useMemo(
    () => ({
      items: displayItems,
      renderItem,
      hasMore
    }),
    [displayItems, hasMore, renderItem]
  )

  const itemCount = displayItems.length + (hasMore ? 1 : 0)

  return (
    <div ref={containerRef} className={className}>
      {displayItems.length > 0 ? (
        <FixedSizeList
          height={height}
          itemCount={itemCount}
          itemData={itemData}
          itemKey={(index, data) =>
            data.hasMore && index >= data.items.length
              ? `loader-${index}`
              : itemKey
                ? itemKey(index, data.items[index])
                : data.items[index]?.id || index
          }
          itemSize={itemSize}
          onItemsRendered={({ visibleStopIndex }) => {
            if (hasMore && !loading && visibleStopIndex >= displayItems.length - LOAD_MORE_THRESHOLD) {
              onLoadMore?.()
            }
          }}
          overscanCount={overscanCount}
          width="100%"
        >
          {VirtualizedRow}
        </FixedSizeList>
      ) : (
        emptyState
      )}
    </div>
  )
}

export default VirtualizedQueueEntityList
