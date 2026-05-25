import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuListMusic } from 'react-icons/lu'
import { RiShuffleLine } from 'react-icons/ri'
import { Bounce, toast } from 'react-toastify'
import { RiArrowLeftLine } from 'react-icons/ri'
import { PlaylistItem } from '../../../Pages/Playlists/PlaylistItem'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import { useQueue } from '../../../Contexts/QueueContext'
import { dedupedInvoke } from '../../../Contexts/utils'
import Cola from '../../Cola/Cola'
import VirtualizedQueueEntityList from '../VirtualizedQueueEntityList'
import './PlaylistsQueueTab.scss'

const PLAYLIST_ROW_HEIGHT = 76
const PLAYLIST_OVERSCAN = 6

function PlaylistsQueueTab({ isActive }) {
  const {
    addPlaylisthistory,
    deletingPlaylistPaths,
    getUniqueList,
    isPlaylistDeleting,
    openM3U,
    playlistsLastLoadedAt // needed to sync external changes (import/create)
  } = usePlaylists()
  const { playQueueShuffled } = useQueue()
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const [playingRandom, setPlayingRandom] = useState(false)

  // Local state — independent from global playlists context
  const [queuePlaylists, setQueuePlaylists] = useState([])
  const [queuePlaylistsLoading, setQueuePlaylistsLoading] = useState(false)
  const [queuePlaylistsLoaded, setQueuePlaylistsLoaded] = useState(false)
  const [queuePlaylistsLastLoadedAt, setQueuePlaylistsLastLoadedAt] = useState(null)
  const liteRequestRef = useRef(null)
  const lastGlobalLoadRef = useRef(playlistsLastLoadedAt)

  // Filter out deleting playlists optimistically so they unmount instantly
  const displayedPlaylists = useMemo(() => {
    return queuePlaylists.filter((p) => !deletingPlaylistPaths.includes(p.path))
  }, [queuePlaylists, deletingPlaylistPaths])

  const loadLitePlaylists = useCallback(async ({ force = false } = {}) => {
    if (!force && queuePlaylistsLoaded) {
      return queuePlaylists
    }

    if (liteRequestRef.current && !force) {
      return liteRequestRef.current
    }

    setQueuePlaylistsLoading(true)

    const request = dedupedInvoke('get-playlists-minimal')
      .then((result) => {
        if (result) {
          setQueuePlaylists(result)
          setQueuePlaylistsLoaded(true)
          setQueuePlaylistsLastLoadedAt(Date.now())
        }

        return result
      })
      .catch((error) => {
        console.error('Error loading lite playlists:', error)
        throw error
      })
      .finally(() => {
        if (liteRequestRef.current === request) {
          liteRequestRef.current = null
          setQueuePlaylistsLoading(false)
        }
      })

    liteRequestRef.current = request
    return request
  }, [queuePlaylists, queuePlaylistsLoaded])

  const selectedPlaylistPath = selectedPlaylist?.path
  const selectedPlaylistExists = selectedPlaylistPath
    ? displayedPlaylists.some((playlist) => playlist.path === selectedPlaylistPath)
    : false
  const selectedPlaylistIsDeleting = selectedPlaylistPath
    ? deletingPlaylistPaths.includes(selectedPlaylistPath) || isPlaylistDeleting(selectedPlaylistPath)
    : false

  const handleEmptyStateImport = async () => {
    await openM3U()
    // Give immediate feedback instead of waiting for the full global reload
    void loadLitePlaylists({ force: true }).catch(() => {})
  }

  const playlistsEmptyState =
    displayedPlaylists.length === 0 ? (
      <div className="PlaylistsQueueTab__empty">
        <div className="PlaylistsQueueTab__empty-icon">
          <LuListMusic />
        </div>
        <div className="PlaylistsQueueTab__empty-copy">
          <h3>No playlists yet</h3>
          <p>Import an existing M3U file to start building your playlists library.</p>
        </div>
        <button
          type="button"
          className="PlaylistsQueueTab__empty-action"
          onClick={handleEmptyStateImport}
        >
          <LuListMusic />
          <span>Import M3U</span>
        </button>
      </div>
    ) : null

  // Load lite playlists when the tab becomes active
  useEffect(() => {
    if (isActive && !queuePlaylistsLoaded && !queuePlaylistsLoading) {
      loadLitePlaylists()
    }
  }, [isActive, loadLitePlaylists, queuePlaylistsLoaded, queuePlaylistsLoading])

  // Sync with global state changes (like drag & drop, new playlist, save, etc.)
  useEffect(() => {
    if (playlistsLastLoadedAt !== lastGlobalLoadRef.current) {
      lastGlobalLoadRef.current = playlistsLastLoadedAt
      if (isActive) {
        void loadLitePlaylists({ force: true }).catch(() => {})
        return
      }

      // Force a reload next time the tab becomes active
      setQueuePlaylistsLoaded(false)
    }
  }, [isActive, loadLitePlaylists, playlistsLastLoadedAt])

  useEffect(() => {
    if (!selectedPlaylistPath) return
    if (!selectedPlaylistExists || selectedPlaylistIsDeleting) {
      setSelectedPlaylist(null)
      setCurrentPlaylist(null)
      return
    }

    setCurrentPlaylist(null)
    getUniqueList(setCurrentPlaylist, selectedPlaylistPath)
  }, [
    getUniqueList,
    queuePlaylistsLastLoadedAt,
    selectedPlaylistExists,
    selectedPlaylistIsDeleting,
    selectedPlaylistPath
  ])

  const renderPlaylistRow = useCallback(
    (playlist, index, style) => (
      <PlaylistItem
        key={playlist?.path || index}
        playlist={playlist}
        addPlaylisthistory={addPlaylisthistory}
        index={index}
        disableNavigation
        showDuration={false}
        useGenericCoverFallback
        onSelect={setSelectedPlaylist}
        style={style}
      />
    ),
    [addPlaylisthistory]
  )

  const showRandomButton = !selectedPlaylist && Number(displayedPlaylists.length) > 0

  const handlePlayRandomPlaylist = useCallback(async () => {
    if (playingRandom) {
      return
    }

    setPlayingRandom(true)

    try {
      const randomPlaylist = await dedupedInvoke('get-random-playlist')

      if (!randomPlaylist?.path) {
        toast.error('No hay playlists disponibles para reproducir.', {
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

      const playlistData = await dedupedInvoke('get-list', randomPlaylist.path)
      const tracks = playlistData?.processedData || []

      if (tracks.length === 0) {
        toast.error('La playlist aleatoria no tiene canciones disponibles.', {
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

      playQueueShuffled(tracks, randomPlaylist.path)
      addPlaylisthistory(randomPlaylist.path)
    } catch (error) {
      console.error('Error playing random playlist:', error)
      toast.error(error?.message || 'No se pudo reproducir una playlist aleatoria.', {
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
      setPlayingRandom(false)
    }
  }, [addPlaylisthistory, playQueueShuffled, playingRandom])

  if (selectedPlaylist) {
    return (
      <div className="PlaylistsQueueTab">
        <div className="PlaylistsQueueTab__bar">
          <button 
            type="button" 
            className="back-btn"
            onClick={() => setSelectedPlaylist(null)}
            title="Back to list"
          >
            <RiArrowLeftLine />
          </button>
          <span className="current-path">{selectedPlaylist.nombre}</span>
        </div>
        <Cola
          height="100%"
          list={currentPlaylist?.processedData || []}
          name={selectedPlaylist.path}
          preserveOrder
          enablePinMove
          pinMoveScope="source-local"
          sourceKey={selectedPlaylist.path}
        />
      </div>
    )
  }

  return (
    <div className="PlaylistsQueueTab">
      <VirtualizedQueueEntityList
        className="PlaylistsQueueTab__list"
        items={displayedPlaylists}
        itemSize={PLAYLIST_ROW_HEIGHT}
        overscanCount={PLAYLIST_OVERSCAN}
        itemKey={(index, playlist) => playlist?.path || `playlist-${index}`}
        renderItem={renderPlaylistRow}
        loading={!queuePlaylistsLoaded && queuePlaylistsLoading}
        emptyState={playlistsEmptyState}
      />
      {showRandomButton ? (
        <button
          type="button"
          className="PlaylistsQueueTab__random-fab"
          onClick={() => void handlePlayRandomPlaylist()}
          title="Random playlist"
          aria-label="Play random playlist"
          disabled={playingRandom}
        >
          <RiShuffleLine />
        </button>
      ) : null}
    </div>
  )
}

export default PlaylistsQueueTab
