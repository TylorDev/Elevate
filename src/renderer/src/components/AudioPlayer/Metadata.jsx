import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../Contexts/AppContext'
import './Metadata.scss'

export function Metadata() {
  const { currentFile, BinToBlob } = useAppContext()
  const navigate = useNavigate()

  return (
    <div
      className="metadata"
      id="metadata"
      onClick={() => {
        navigate('/music')
      }}
    >
      <div className="cover">
        <img src={BinToBlob(currentFile?.picture?.[0] || {})} alt="" />
      </div>
      <div className="data">
        <div className="data-tittle">
          {currentFile.title ? currentFile.title : currentFile.fileName}
        </div>
        <div className="data-artist">{currentFile.artist || 'Unknown'}</div>
        <div className="data-bpm">{currentFile.bpm || '000'}</div>
      </div>
    </div>
  )
}
