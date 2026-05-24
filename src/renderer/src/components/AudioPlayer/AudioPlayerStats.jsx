import { LuEye, LuFolder, LuRepeat2, LuSkipForward } from 'react-icons/lu'

export function AudioPlayerStats({ shortViews, repeats, skips, containerFolderName }) {
  return (
    <div className="AudioPlayer__Stats">
      <span className="AudioPlayer__cortas">
        <LuEye />
        <strong>{shortViews}</strong>
      </span>
      {containerFolderName ? (
        <span className="AudioPlayer__folder" title={containerFolderName}>
          <LuFolder />
          <strong>{containerFolderName}</strong>
        </span>
      ) : null}
      <span className="AudioPlayer__repeats">
        <LuRepeat2 />
        <strong>{repeats}</strong>
      </span>
      <span className="AudioPlayer__skips">
        <LuSkipForward />
        <strong>{skips}</strong>
      </span>
    </div>
  )
}
