export function SongData({ metadata, handleSongClick, currentIndex }) {
  return (
    <div>
      {metadata && metadata.length > 0 ? (
        <ul>
          {metadata.map((file, index) => (
            <div className="div" key={index}>
              <li
                style={{
                  fontSize: '11px',
                  cursor: 'pointer',
                  border: index === currentIndex ? '2px solid red' : '1px solid white',
                  color: index === currentIndex ? 'red' : ' white'
                }}
                onClick={() => handleSongClick(file, index)}
              >
                {file.fileName}
              </li>
            </div>
          ))}
        </ul>
      ) : (
        <p>No files selected</p>
      )}
    </div>
  )
}
