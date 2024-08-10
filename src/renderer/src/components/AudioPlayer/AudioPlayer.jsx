/* eslint-disable react/prop-types */
import './AudioPlayer.scss'

import { MediaTimeDisplay } from '../MediaTimeDisplay/MediaTimeDisplay'

import { useNavigate } from 'react-router-dom'
import { Controls } from '../Controls/Controls'
import { useAppContext } from '../../Contexts/AppContext'
import { useEffect } from 'react'

export function AudioPlayer() {
  const { currentFile, BinToBlob, handleNextClick, handlePreviousClick, mediaRef } = useAppContext()

  useEffect(() => {
    const audio = mediaRef.current

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentFile.title ? currentFile.title : currentFile.fileName,
        artist: currentFile.artist || 'Unknown',
        album: 'Unknown',
        artwork: [
          {
            src: BinToBlob(currentFile?.picture?.[0] || {}),
            sizes: '300x300',
            type: 'image/jpeg'
          }
        ]
      })

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play()
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause()
      })

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(audio.currentTime - (details.seekOffset || 10), 0)
      })

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(audio.currentTime + (details.seekOffset || 10), audio.duration)
      })

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePreviousClick()
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextClick()
      })
    }
  }, [currentFile])
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
          <div>{currentFile.artist || 'Unknown'}</div>

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
