import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FixedSizeList } from 'react-window'

const DEFAULT_MIN_HEIGHT = 240
const DEFAULT_LOADING_COUNT = 4

const VirtualizedRow = memo(function VirtualizedRow({ index, style, data }) {
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
      renderItem
    }),
    [displayItems, renderItem]
  )

  return (
    <div ref={containerRef} className={className}>
      {displayItems.length > 0 ? (
        <FixedSizeList
          height={height}
          itemCount={displayItems.length}
          itemData={itemData}
          itemKey={(index, data) =>
            itemKey ? itemKey(index, data.items[index]) : data.items[index]?.id || index
          }
          itemSize={itemSize}
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
