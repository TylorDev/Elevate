import { useCallback, useEffect, useState } from 'react'
import { RiPlayFill } from 'react-icons/ri'
import { Bounce, toast } from 'react-toastify'
import { useI18n } from '../../../Contexts/I18nContext'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { useQueue } from '../../../Contexts/QueueContext'
import { dedupedInvoke } from '../../../Contexts/utils'
import { VirtualizedCola } from '../../Cola/VirtualizedCola'
import './AllSongsQueueTab.scss'

const TRACKS_PAGE_SIZE = 100

function AllSongsQueueTab({ isActive }) {
  const { t } = useI18n()
  const { allSongs, allSongsHasMore, allSongsLoading, allSongsPage, getAllSongs } = usePlaylists()
  const { playQueueShuffled } = useQueue()
  const [playingAll, setPlayingAll] = useState(false)

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

  const handlePlayAll = useCallback(async () => {
    if (playingAll) {
      return
    }

    setPlayingAll(true)

    try {
      const tracks = await dedupedInvoke('get-all-audio-files')

      if (!Array.isArray(tracks) || tracks.length === 0) {
        toast.error(t('queue.allSongsUnavailable'), {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        })
        return
      }

      playQueueShuffled(tracks, 'tracks')
    } catch (error) {
      console.error('Error playing all songs:', error)
      toast.error(error?.message || 'Could not play the full library.', {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'dark',
        transition: Bounce
      })
    } finally {
      setPlayingAll(false)
    }
  }, [playQueueShuffled, playingAll, t])

  return (
    <div className="AllSongsQueueTab">
      <VirtualizedCola
        height="100%"
        list={allSongs}
        name="tracks"
        hasMore={allSongsHasMore}
        isLoading={allSongsLoading}
        onLoadMore={loadMoreTracks}
      />
      <button
        type="button"
        className="AllSongsQueueTab__play-all-fab"
        onClick={() => void handlePlayAll()}
        title="Play all"
        aria-label="Play the full library"
        disabled={playingAll}
      >
        <RiPlayFill />
      </button>
    </div>
  )
}

export default AllSongsQueueTab
