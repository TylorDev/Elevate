export function AudioPlayerMetadata({ title, artist, children }) {
  return (
    <div className="AudioPlayer__Metadata">
      <div className="AudioPlayer__title">{title}</div>
      <div className="AudioPlayer__artist">{artist}</div>
      {children}
    </div>
  )
}
