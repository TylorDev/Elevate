import { useMemo, useState } from 'react'
import { Bounce, toast } from 'react-toastify'
import { LuListPlus, LuPlus, LuRefreshCw } from 'react-icons/lu'
import Modal from '../Modal/Modal'
import { PlaylistSaveModal } from '../PlaylistSaveModal/PlaylistSaveModal'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './CollectionAddToPlaylistModal.scss'

export function CollectionAddToPlaylistModal({
  isVisible,
  onClose,
  tracks = [],
  currentCollectionPath = '',
  sourceName = ''
}) {
  const { playlists, appendTracksToPlaylist } = usePlaylists()
  const [isSavingToExisting, setIsSavingToExisting] = useState(false)
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false)

  const eligiblePlaylists = useMemo(
    () => playlists.filter((playlist) => playlist?.path && playlist.path !== currentCollectionPath),
    [currentCollectionPath, playlists]
  )

  const handleAppendToPlaylist = async (playlistPath, playlistName) => {
    setIsSavingToExisting(true)

    try {
      const result = await appendTracksToPlaylist(playlistPath, tracks)

      if (!result?.success) {
        toast.error(result?.error || 'Could not add the songs.', {
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

      toast.success(
        `Added ${result.addedCount || 0} songs to ${playlistName}${
          result.skippedCount ? ` - ${result.skippedCount} repeated` : ''
        }`,
        {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: 'dark',
          transition: Bounce
        }
      )
      onClose()
    } finally {
      setIsSavingToExisting(false)
    }
  }

  return (
    <>
      <Modal
        isVisible={isVisible}
        closeModal={onClose}
        contentClassName="collection-add-to-playlist-modal"
      >
        <div className="collection-add-to-playlist-modal__header">
          <div>
            <span>Collection routing</span>
            <h2>Add to playlist</h2>
          </div>
          <button
            type="button"
            className="collection-add-to-playlist-modal__new"
            onClick={() => setIsSaveModalVisible(true)}
          >
            <LuPlus />
            Create new playlist
          </button>
        </div>

        <div className="collection-add-to-playlist-modal__summary">
          <LuListPlus />
          <span>{tracks.length} songs ready to add</span>
        </div>

        <div className="collection-add-to-playlist-modal__list">
          {eligiblePlaylists.length === 0 ? (
            <div className="collection-add-to-playlist-modal__empty">
              No playlists available to reuse.
            </div>
          ) : (
            eligiblePlaylists.map((playlist) => (
              <button
                key={playlist.path}
                type="button"
                className="collection-add-to-playlist-modal__item"
                onClick={() => handleAppendToPlaylist(playlist.path, playlist.nombre)}
                disabled={isSavingToExisting}
              >
                <span className="collection-add-to-playlist-modal__item-name">{playlist.nombre}</span>
                <span className="collection-add-to-playlist-modal__item-meta">
                  {playlist.numElementos ?? 0} tracks
                </span>
              </button>
            ))
          )}
        </div>

        {isSavingToExisting && (
          <div className="collection-add-to-playlist-modal__loading">
            <LuRefreshCw />
            Adding songs...
          </div>
        )}
      </Modal>

      <PlaylistSaveModal
        isVisible={isSaveModalVisible}
        onClose={() => setIsSaveModalVisible(false)}
        tracks={tracks}
        sourceName={sourceName}
      />
    </>
  )
}

export default CollectionAddToPlaylistModal
