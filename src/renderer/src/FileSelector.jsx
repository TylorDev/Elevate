/* eslint-disable prettier/prettier */
import { useState, useEffect, useRef } from 'react'

const FilePathsComponent = () => {
  const [filepath, setFilePath] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleButtonClick = async () => {
    setLoading(true)
    try {
      const url = await window.electron.ipcRenderer.invoke('select-file')

      setFilePath(url)
      console.log(url)
    } catch (error) {
      console.error('Error fetching file paths:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMetadata = async (path) => {
    try {
      const fileInfo = await window.electron.ipcRenderer.invoke('get-file-info', path)

      setMetadata(fileInfo)
    } catch (error) {
      console.error('Error fetching file info:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleButtonClick} disabled={loading}>
        {loading ? 'Loading...' : 'Select Files'}
      </button>

      <button onClick={() => getMetadata(filepath)} disabled={loading}>
        {loading ? 'Loading...' : 'Meta'}
      </button>
      <div>
        <h3>Información del Audio</h3>
      </div>

      <div>{filepath && <AudioPlayer url={filepath} metadata={metadata} />}</div>
    </div>
  )
}

export default FilePathsComponent
const AudioPlayer = ({ url, metadata }) => {
  const BinToBlob = (img, mimeType = 'image/png') => {
    console.log(img.type)

    if (img.type != 'Other') {
      const blob = new Blob([img.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      console.log(url)
      return url
    } else {
      return ''
    }
  }

  return (
    <div>
      <img
        src={
          metadata?.picture?.[0]?.data
            ? BinToBlob(metadata.picture[0])
            : 'https://i.pinimg.com/564x/ca/2d/fe/ca2dfe6759c3e0183f83617364edbe2c.jpg'
        }
        style={{ width: '200px' }}
        alt=""
      />
      {metadata?.picture?.[0]?.data && console.log(metadata.picture[0].data)}
      <audio controls key={url}>
        <source src={url} type="audio/mpeg" />
        Tu navegador no soporta el elemento de audio.
      </audio>
    </div>
  )
}
