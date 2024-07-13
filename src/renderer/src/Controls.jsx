export function Controls({ handlePreviousClick, handleNextClick }) {
  return (
    <div>
      <button onClick={handlePreviousClick}>Previous</button>
      <button onClick={handleNextClick}>Next</button>
    </div>
  )
}
