import { useNavigate } from 'react-router-dom'

import './Metadata.scss'

import { useSuper } from '../../Contexts/SupeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

export function Metadata() {
  const { currentFile } = useSuper()
  const navigate = useNavigate()
  const { currentCover } = usePlaylists()

  return (
    <div
      className="metadata"
      id="metadata"
      onClick={() => {
        navigate('/music')
      }}
    >
      <div className="cover">
        <img src={currentCover} alt="sin cover" />
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
