/* eslint-disable react/prop-types */
import { useAppContext } from './Contexts/AppContext'

export function Controls() {
  const { handleNextClick, handlePreviousClick, togglePlayPause, isPlaying } = useAppContext()

  return (
    <div className="controls">
      <button onClick={handlePreviousClick}>Previous</button>
      <button onClick={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={handleNextClick}>Next</button>
    </div>
  )
}
