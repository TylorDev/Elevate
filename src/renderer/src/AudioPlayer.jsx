/* eslint-disable react/prop-types */
export function AudioPlayer({ currentFile, next, previus }) {
  const BinToBlob = (img, mimeType = 'image/png') => {
    if (img && img.data && img.type !== 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      return url
    }
    return 'https://i.pinimg.com/564x/ca/2d/fe/ca2dfe6759c3e0183f83617364edbe2c.jpg'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src={BinToBlob(currentFile?.picture?.[0] || {})} style={{ width: '200px' }} alt="" />
        <p>{currentFile.title ? currentFile.title : currentFile.fileName}</p>
      </div>

      <audio controls key={currentFile.filePath} autoPlay onEnded={next}>
        <source src={currentFile.filePath} type="audio/mpeg" />
        Tu navegador no soporta el elemento de audio.
      </audio>
    </div>
  )
}
