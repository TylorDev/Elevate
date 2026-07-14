import { LuEye, LuFolder, LuRepeat2, LuSkipForward } from 'react-icons/lu'

export function AudioPlayerStats({ shortViews, repeats, skips, containerFolderName }) {
  return (
    <div className="AudioPlayer__Stats">
      <div className="AudioPlayer__Stats-row AudioPlayer__Stats-row--metrics">
        <span className="AudioPlayer__stat AudioPlayer__cortas">
          <LuEye />
          <strong>{shortViews}</strong>
        </span>
        <span className="AudioPlayer__stat AudioPlayer__repeats">
          <LuRepeat2 />
          <strong>{repeats}</strong>
        </span>
        <span className="AudioPlayer__stat AudioPlayer__skips">
          <LuSkipForward />
          <strong>{skips}</strong>
        </span>
      </div>
      {containerFolderName ? (
        <div className="AudioPlayer__Stats-row AudioPlayer__Stats-row--folder">
          <span className="AudioPlayer__stat AudioPlayer__folder" title={containerFolderName}>
            <LuFolder />
            <strong>{containerFolderName}</strong>
          </span>
        </div>
      ) : null}
    </div>
  )
}
