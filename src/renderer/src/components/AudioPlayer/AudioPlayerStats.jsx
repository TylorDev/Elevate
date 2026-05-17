import { LuEye, LuSkipForward } from 'react-icons/lu'

export function AudioPlayerStats({ shortViews, skips }) {
  return (
    <div className="AudioPlayer__Stats">
      <span className="AudioPlayer__cortas">
        <LuEye />
        <strong>{shortViews}</strong>
      </span>
      <span className="AudioPlayer__skips">
        <LuSkipForward />
        <strong>{skips}</strong>
      </span>
    </div>
  )
}
