import { useNavigate } from 'react-router-dom'

import './Metadata.scss'

import { useSuper } from '../../Contexts/SupeContext'

export function Metadata() {
  const { currentFile } = useSuper()
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
        <img src={'sin cover'} alt="sin cover" />
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
