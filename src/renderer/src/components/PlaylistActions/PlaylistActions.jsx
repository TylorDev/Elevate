import { useState } from 'react'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './PlaylistActions.scss'

import { useQueue } from '../../Contexts/QueueContext'
import PlaylistSaveModal from '../PlaylistSaveModal/PlaylistSaveModal'

export function PlaylistActions({ name }) {
  const { openM3U } = usePlaylists()
  const { queueState } = useQueue()
  const [isSavePlaylistVisible, setIsSavePlaylistVisible] = useState(false)
  const currentTracks = queueState.currentQueue || []
  const currentSourceName = name || queueState.queueName || ''

  return (
    <div className="PlaylistActions">
      <button
        type="button"
        disabled={currentTracks.length === 0}
        onClick={() => {
          setIsSavePlaylistVisible(true)
        }}
      >
        Save queue to Playlists
      </button>

      <button type="button" onClick={openM3U}>Upload list</button>

      <PlaylistSaveModal
        isVisible={isSavePlaylistVisible}
        onClose={() => setIsSavePlaylistVisible(false)}
        tracks={currentTracks}
        sourceName={currentSourceName}
      />
    </div>
  )
}
