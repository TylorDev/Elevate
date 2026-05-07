import './AllTracks.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { VirtualizedCola } from '../../components/Cola/VirtualizedCola'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'

import { useCallback, useEffect } from 'react'

const TRACKS_PAGE_SIZE = 100

function AllTracks() {
  const { getAllSongs, allSongs, allSongsHasMore, allSongsLoading, allSongsPage } = usePlaylists()

  useEffect(() => {
    if (allSongs.length === 0 && !allSongsLoading && allSongsHasMore) {
      getAllSongs(1, { pageSize: TRACKS_PAGE_SIZE })
    }
  }, [allSongs.length, allSongsHasMore, allSongsLoading, getAllSongs])

  const loadMoreTracks = useCallback(() => {
    if (!allSongsLoading && allSongsHasMore) {
      getAllSongs(allSongsPage + 1, { pageSize: TRACKS_PAGE_SIZE })
    }
  }, [allSongsHasMore, allSongsLoading, allSongsPage, getAllSongs])

  return (
    <div className="AllTracks">
      {/* <PlaylistActions /> */}
      <VirtualizedCola
        list={allSongs}
        name={'tracks'}
        hasMore={allSongsHasMore}
        isLoading={allSongsLoading}
        onLoadMore={loadMoreTracks}
      />
    </div>
  )
}
export default AllTracks
