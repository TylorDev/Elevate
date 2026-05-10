import { useCallback, useEffect, useState } from 'react'
import { RiArrowLeftLine } from 'react-icons/ri'
import { PlaylistItem } from '../../../Pages/Playlists/PlaylistItem'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import Cola from '../../Cola/Cola'
import VirtualizedQueueEntityList from '../VirtualizedQueueEntityList'
import './PlaylistsQueueTab.scss'

const PLAYLIST_ROW_HEIGHT = 76
const PLAYLIST_OVERSCAN = 6

function PlaylistsQueueTab({ isActive }) {
  const {
    addPlaylisthistory,
    getSavedLists,
    getUniqueList,
    playlists,
    playlistsLastLoadedAt,
    playlistsLoaded,
    playlistsLoading
  } = usePlaylists()
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const selectedPlaylistPath = selectedPlaylist?.path

  useEffect(() => {
    if (isActive && !playlistsLoaded && !playlistsLoading) {
      getSavedLists()
    }
  }, [getSavedLists, isActive, playlistsLoaded, playlistsLoading])

  useEffect(() => {
    if (!selectedPlaylistPath) return

    setCurrentPlaylist(null)
    getUniqueList(setCurrentPlaylist, selectedPlaylistPath)
  }, [getUniqueList, playlistsLastLoadedAt, selectedPlaylistPath])

  const renderPlaylistRow = useCallback(
    (playlist, index, style) => (
      <PlaylistItem
        key={playlist?.path || index}
        playlist={playlist}
        addPlaylisthistory={addPlaylisthistory}
        index={index}
        disableNavigation
        onSelect={setSelectedPlaylist}
        style={style}
      />
    ),
    [addPlaylisthistory]
  )

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
        items={playlists}
        itemSize={PLAYLIST_ROW_HEIGHT}
        overscanCount={PLAYLIST_OVERSCAN}
        itemKey={(index, playlist) => playlist?.path || `playlist-${index}`}
        renderItem={renderPlaylistRow}
        loading={!playlistsLoaded && playlistsLoading}
      />
    </div>
  )
}

export default PlaylistsQueueTab
