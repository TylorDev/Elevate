/* eslint-disable react/prop-types */
import './AudioPlayer.scss'
import { useAppContext } from './Contexts/AppContext'
import { Controls } from './Controls'
import { MediaTimeDisplay } from './MediaTimeDisplay'

import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function AudioPlayer() {
  const { currentFile, BinToBlob, handleNextClick, mediaRef, queue } = useAppContext()

  const navigate = useNavigate()
  return (
    <div className="AudioPlayer" id="AudioPlayer">
      <div
        className="metadata"
        onClick={() => {
          navigate('/music')
        }}
      >
        <div className="cover">
          <img src={BinToBlob(currentFile?.picture?.[0] || {})} alt="" />
        </div>
        <div className="data">
          <div>{currentFile.title ? currentFile.title : currentFile.fileName}</div>
          <div>{currentFile.artist}</div>
          <div>{currentFile.BPM}</div>
        </div>
      </div>

      <Controls />

      <div className="audiosrc">
        <audio
          ref={mediaRef}
          controls
          autoPlay
          onEnded={handleNextClick}
          style={{ display: 'none' }}
        >
          <source src={currentFile.filePath} type="audio/mpeg" />
          Tu navegador no soporta el elemento de audio.
        </audio>
        <MediaTimeDisplay />
      </div>
    </div>
  )
}
