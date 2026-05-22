import { memo, useMemo } from 'react'
import { LuFolderOpen, LuListMusic } from 'react-icons/lu'
import { formatDuration } from '../../../../timeUtils'
import { useImages } from '../../../Contexts/ImagesContext'
import './CollectionEntityItem.scss'

function formatMetricNumber(value) {
  return new Intl.NumberFormat('es').format(Number(value) || 0)
}

function CollectionEntityItemComponent({
  collection,
  insightValueLabel = '',
  onOpen,
  style
}) {
  const { getCollectionCoverUrl, DEFAULT_COVER } = useImages()
  const coverUrl = useMemo(() => {
    if (!collection?.cover) {
      return DEFAULT_COVER
    }

    return getCollectionCoverUrl(
      `feed:${collection.type}:${collection.path}`,
      collection.cover
    )
  }, [DEFAULT_COVER, collection?.cover, collection?.path, collection?.type, getCollectionCoverUrl])

  if (!collection) {
    return null
  }

  const Icon = collection.type === 'playlist' ? LuListMusic : LuFolderOpen

  return (
    <div className="collection-entity-item" style={style}>
      <button type="button" className="collection-entity-item__button" onClick={onOpen}>
        <div className="collection-entity-item__cover">
          <img src={coverUrl} loading="lazy" alt="" />
          <span>
            <Icon />
          </span>
        </div>

        <div className="collection-entity-item__body">
          <div className="collection-entity-item__title-row">
            <strong>{collection.name}</strong>
            <em>{collection.type === 'playlist' ? 'Playlist' : 'Directory'}</em>
          </div>
          <span className="collection-entity-item__path">{collection.path}</span>
          <div className="collection-entity-item__meta">
            <span>{formatMetricNumber(collection.totalShortViews)} short views</span>
            <span>{formatDuration(collection.totalDuration)}</span>
            <span>{formatMetricNumber(collection.trackCount)} tracks</span>
          </div>
        </div>

        <div className="collection-entity-item__insight">
          <span>{insightValueLabel}</span>
        </div>
      </button>
    </div>
  )
}

export const CollectionEntityItem = memo(CollectionEntityItemComponent)

export default CollectionEntityItem
