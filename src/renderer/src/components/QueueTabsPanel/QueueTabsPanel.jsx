import { useState } from 'react'
import { 
  RiPlayList2Fill, 
  RiFoldersFill, 
  RiFolderMusicFill, 
  RiHeartFill, 
  RiMusic2Fill 
} from 'react-icons/ri'
import './QueueTabsPanel.scss'

import AllSongsQueueTab from './AllSongs/AllSongsQueueTab'
import CurrentQueueTab from './Current/CurrentQueueTab'
import DirectoriesQueueTab from './Directories/DirectoriesQueueTab'
import LikesQueueTab from './Likes/LikesQueueTab'
import PlaylistsQueueTab from './Playlists/PlaylistsQueueTab'
import { useSession } from '../../Contexts/SessionContext'

const TABS = [
  { id: 'current', label: 'Current', icon: <RiPlayList2Fill />, Component: CurrentQueueTab },
  { id: 'playlists', label: 'Playlists', icon: <RiFoldersFill />, Component: PlaylistsQueueTab },
  { id: 'directories', label: 'Directories', icon: <RiFolderMusicFill />, Component: DirectoriesQueueTab },
  { id: 'likes', label: 'Likes', icon: <RiHeartFill />, Component: LikesQueueTab },
  { id: 'all', label: 'All', icon: <RiMusic2Fill />, Component: AllSongsQueueTab }
]

function QueueTabsPanel() {
  const { queueState } = useSession()
  const [activeTab, setActiveTab] = useState('current')

  return (
    <aside className="QueueTabsPanel">
      <div className="QueueTabsPanel__header">
        <div className="QueueTabsPanel__tabs" role="tablist" aria-label="Queue sources">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'QueueTabsPanel__tab is-active' : 'QueueTabsPanel__tab'}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`queue-tab-${id}`}
              id={`queue-tab-button-${id}`}
              onClick={() => setActiveTab(id)}
              title={label}
            >
              <span className="tab-icon">{icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="QueueTabsPanel__body">
        {TABS.map(({ id, Component }) => (
          <section
            key={id}
            className={activeTab === id ? 'QueueTabsPanel__pane is-active' : 'QueueTabsPanel__pane'}
            role="tabpanel"
            id={`queue-tab-${id}`}
            aria-labelledby={`queue-tab-button-${id}`}
            hidden={activeTab !== id}
          >
            <Component isActive={activeTab === id} />
          </section>
        ))}
      </div>
    </aside>
  )
}

export default QueueTabsPanel
