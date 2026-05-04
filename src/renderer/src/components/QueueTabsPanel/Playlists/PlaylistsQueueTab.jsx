import { useEffect, useRef, useState } from 'react'
import { PlaylistItem } from '../../../Pages/Playlists/PlaylistItem'
import { usePlaylists } from '../../../Contexts/PlaylistsContex'
import Cola from '../../Cola/Cola'
import './PlaylistsQueueTab.scss'

function PlaylistsQueueTab({ isActive }) {
  const {
    addPlaylisthistory,
    getSavedLists,
    getUniqueList,
    playlists,
    playlistsLoaded,
    playlistsLoading
  } = usePlaylists()
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const getUniqueListRef = useRef(getUniqueList)
  const selectedPlaylistPath = selectedPlaylist?.path

  useEffect(() => {
    if (isActive && !playlistsLoaded && !playlistsLoading) {
      getSavedLists()
    }
  }, [getSavedLists, isActive, playlistsLoaded, playlistsLoading])

  useEffect(() => {
    getUniqueListRef.current = getUniqueList
  }, [getUniqueList])

  useEffect(() => {
    if (!selectedPlaylistPath) return

    setCurrentPlaylist(null)
    getUniqueListRef.current(setCurrentPlaylist, selectedPlaylistPath)
  }, [selectedPlaylistPath])

  if (selectedPlaylist) {
    return (
      <div className="PlaylistsQueueTab">
        <div className="PlaylistsQueueTab__bar">
          <button type="button" onClick={() => setSelectedPlaylist(null)}>
            List
          </button>
          <span>{selectedPlaylist.nombre}</span>
        </div>
        <Cola
          list={currentPlaylist?.processedData || []}
          name={selectedPlaylist.path}
          filePath={selectedPlaylist.path}
        />
      </div>
    )
  }

  return (
    <div className="PlaylistsQueueTab">
      <ul className="PlaylistsQueueTab__list">
        {playlists.length > 0 ? (
          playlists.map((playlist, index) => (
            <PlaylistItem
              key={playlist.path || index}
              playlist={playlist}
              addPlaylisthistory={addPlaylisthistory}
              index={index}
              disableNavigation
              onSelect={setSelectedPlaylist}
            />
          ))
        ) : (
          <>
            <PlaylistItem />
            <PlaylistItem />
            <PlaylistItem />
          </>
        )}
      </ul>
    </div>
  )
}

export default PlaylistsQueueTab
