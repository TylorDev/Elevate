import React from 'react'
import { TrackCard } from '../../../components/TrackCard/TrackCard'
import './FeedRankingRail.scss'

function FeedRankingRail({ title, songs, railId, emptyMessage = 'Todavía no hay datos para este ranking' }) {
  return (
    <div className="feed-ranking-rail">
      <h3 className="feed-ranking-rail__title">{title}</h3>
      
      {songs.length === 0 ? (
        <div className="feed-ranking-rail__empty">{emptyMessage}</div>
      ) : (
        <div className="feed-ranking-rail__container">
          {songs.map((song, index) => (
            <TrackCard 
              key={`${railId}-${song.filePath}`} 
              song={song} 
              index={index} 
              list={songs} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default FeedRankingRail
