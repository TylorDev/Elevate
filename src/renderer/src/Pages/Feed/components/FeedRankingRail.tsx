import React from 'react'
import { TrackCard } from '../../../components/TrackCard/TrackCard'
import './FeedRankingRail.scss'

function FeedRankingRail({
  title,
  songs,
  railId,
  emptyMessage = 'There is no data for this ranking yet'
}) {
  return (
    <div className="feed-ranking-rail">
      {songs.length === 0 ? (
        <div className="feed-ranking-rail__empty">{emptyMessage}</div>
      ) : (
        <div className="feed-ranking-rail__container">
          {songs.map((song, index) => (
            <TrackCard key={`${railId}-${song.filePath}`} song={song} index={index} list={songs} />
          ))}
        </div>
      )}
    </div>
  )
}

export default FeedRankingRail
