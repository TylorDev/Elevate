import { LuFolderOpen, LuListMusic, LuSettings2 } from 'react-icons/lu'
import { useSuper } from '../../Contexts/SupeContext'
import { formatDuration } from '../../../timeUtils'
import { UndefinedItem } from '../UndefinedItem/UndefinedItem'
import VirtualizedQueueEntityList from '../QueueTabsPanel/VirtualizedQueueEntityList'

function resolveCover(item, getImage) {
  if (item.type === 'playlist' && item.cover) {
    return getImage(`search-playlist:${item.path}`, item.cover)
  }

  return null
}

function resolveIcon(item) {
  if (item.type === 'directory') {
    return <LuFolderOpen />
  }

  if (item.type === 'playlist') {
    return <LuListMusic />
  }

  return <LuSettings2 />
}

function resolveSubtitle(item) {
  if (item.subtitle) {
    return item.subtitle
  }

  if (item.type === 'directory') {
    return `${item.totalTracks ?? 0} tracks`
  }

  return ''
}

function resolveExtraInfo(item) {
  if (item.type === 'playlist' && Number(item.duracion) > 0) {
    return formatDuration(item.duracion)
  }

  if (item.type === 'directory' && Number(item.totalDuration) > 0) {
    return formatDuration(item.totalDuration)
  }

  return item.meta || ''
}

function resolveDetailsRoute(item) {
  if (item?.type === 'playlist' && item.path) {
    return `/playlists/${item.path}`
  }

  if (item?.type === 'directory' && item.path) {
    return `/directories/${encodeURIComponent(item.path)}/false`
  }

  return undefined
}

export function SearchEntityList({
  items = [],
  loading = false,
  emptyState = null,
  onSelect,
  onLoadMore,
  hasMore = false
}) {
  const { getImage } = useSuper()
  const shouldRenderStaticList = !loading && !hasMore && items.length > 0 && items.length <= 6

  if (shouldRenderStaticList) {
    return (
      <ul className="search-overlay__entity-list search-overlay__entity-list--static">
        {items.map((item, index) => {
          const cover = resolveCover(item, getImage)

          return (
            <UndefinedItem
              key={item?.id || index}
              cover={cover || resolveIcon(item)}
              title={item?.title || 'Untitled'}
              subtitle={resolveSubtitle(item)}
              extraInfo={resolveExtraInfo(item)}
              onTitleClick={() => onSelect?.(item)}
              onPlayClick={() => onSelect?.(item)}
              detailsTo={resolveDetailsRoute(item)}
              className="search-overlay__entity-item"
            />
          )
        })}
      </ul>
    )
  }

  return (
    <VirtualizedQueueEntityList
      className="search-overlay__entity-list"
      items={items}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={onLoadMore}
      emptyState={emptyState}
      itemSize={74}
      overscanCount={5}
      itemKey={(index, item) => item?.id || `${item?.type || 'entity'}-${index}`}
      renderItem={(item, index, style) => {
        if (!item) {
          return (
            <UndefinedItem
              key={`loading-${index}`}
              isLoading
              className="search-overlay__entity-item"
              style={style}
            />
          )
        }

        const cover = resolveCover(item, getImage)

        return (
          <UndefinedItem
            key={item?.id || index}
            cover={cover || resolveIcon(item)}
            title={item?.title || 'Untitled'}
            subtitle={resolveSubtitle(item)}
            extraInfo={resolveExtraInfo(item)}
            onTitleClick={() => onSelect?.(item)}
            onPlayClick={() => onSelect?.(item)}
            detailsTo={resolveDetailsRoute(item)}
            className="search-overlay__entity-item"
            style={style}
          />
        )
      }}
    />
  )
}

export default SearchEntityList
