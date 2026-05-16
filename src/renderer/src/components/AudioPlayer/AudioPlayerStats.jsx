export function AudioPlayerStats({ shortViews, skips }) {
  return (
    <div className="AudioPlayer__Stats">
      <span className="AudioPlayer__cortas">
        <strong>{shortViews}</strong> Cortas
      </span>
      <span className="AudioPlayer__skips">
        <strong>{skips}</strong> Skips
      </span>
    </div>
  )
}
