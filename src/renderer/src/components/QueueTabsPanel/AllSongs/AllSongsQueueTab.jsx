import { useCallback, useEffect } from 'react'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { VirtualizedCola } from '../../Cola/VirtualizedCola'
import './AllSongsQueueTab.scss'

const TRACKS_PAGE_SIZE = 100

function AllSongsQueueTab({ isActive }) {
  const { allSongs, allSongsHasMore, allSongsLoading, allSongsPage, getAllSongs } = usePlaylists()

  useEffect(() => {
    if (isActive && allSongs.length === 0 && !allSongsLoading && allSongsHasMore) {
      getAllSongs(1, { pageSize: TRACKS_PAGE_SIZE })
    }
  }, [allSongs.length, allSongsHasMore, allSongsLoading, getAllSongs, isActive])

  const loadMoreTracks = useCallback(() => {
    if (!allSongsLoading && allSongsHasMore) {
      getAllSongs(allSongsPage + 1, { pageSize: TRACKS_PAGE_SIZE })
    }
  }, [allSongsHasMore, allSongsLoading, allSongsPage, getAllSongs])

  return (
    <div className="AllSongsQueueTab">
      <VirtualizedCola
        list={allSongs}
        name="tracks"
        hasMore={allSongsHasMore}
        isLoading={allSongsLoading}
        onLoadMore={loadMoreTracks}
      />
    </div>
  )
}

export default AllSongsQueueTab
