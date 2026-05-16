export function AudioPlayerMetadata({ title, artist }) {
  return (
    <div className="AudioPlayer__Metadata">
      <div className="AudioPlayer__title">{title}</div>
      <div className="AudioPlayer__artist">{artist}</div>
    </div>
  )
}
