export function Controls({ handlePreviousClick, handleNextClick, togglePlayPause, isPlaying }) {
  return (
    <div className="controls">
      <button onClick={handlePreviousClick}>Previous</button>
      <button onClick={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={handleNextClick}>Next</button>
    </div>
  )
}
