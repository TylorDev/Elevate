import { useEffect, useState } from 'react'
import { Cola } from '../../components/Cola/Cola'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { LuClock, LuActivity, LuSparkles } from 'react-icons/lu'
import './Search.scss'

const SEARCH_TABS = [
  { id: 0, label: 'Recently Played', icon: <LuClock /> },
  { id: 1, label: 'Most Played', icon: <LuActivity /> },
  { id: 2, label: 'New Releases', icon: <LuSparkles /> }
]

function Search() {
  const { recents, getRecents, most, getMost } = useMini()
  const { news, getNews } = usePlaylists()
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    if (activeTab === 0) getRecents()
    if (activeTab === 1) getMost()
    if (activeTab === 2) getNews()
  }, [activeTab])

  return (
    <div className="SearchPage">
      <nav className="search-tabs">
        {SEARCH_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`search-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="search-results">
        {activeTab === 0 && (
          <div className="tab-pane">
            <Cola list={recents} name="recent" />
          </div>
        )}
        {activeTab === 1 && (
          <div className="tab-pane">
            <Cola list={most} name="most" />
          </div>
        )}
        {activeTab === 2 && (
          <div className="tab-pane">
            <Cola list={news} name="news" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
