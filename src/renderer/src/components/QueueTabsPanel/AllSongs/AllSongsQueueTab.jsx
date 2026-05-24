import { useCallback, useEffect, useState } from 'react'
import { RiPlayFill } from 'react-icons/ri'
import { Bounce, toast } from 'react-toastify'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { useQueue } from '../../../Contexts/QueueContext'
import { dedupedInvoke } from '../../../Contexts/utils'
import { VirtualizedCola } from '../../Cola/VirtualizedCola'
import './AllSongsQueueTab.scss'

const TRACKS_PAGE_SIZE = 100

function AllSongsQueueTab({ isActive }) {
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
        toast.error('No hay canciones disponibles para reproducir.', {
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
      toast.error(error?.message || 'No se pudo reproducir toda la biblioteca.', {
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
  }, [playQueueShuffled, playingAll])

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
        title="Reproducir todo"
        aria-label="Reproducir toda la biblioteca"
        disabled={playingAll}
      >
        <RiPlayFill />
      </button>
    </div>
  )
}

export default AllSongsQueueTab
