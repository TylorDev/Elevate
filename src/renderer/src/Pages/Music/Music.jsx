import { useEffect, useState } from 'react'
import './Music.scss'

import { CurrentPlaying } from './../Feed/CurrentPlaying'
import Render from '../../components/Render/Render'
import { useSuper } from '../../Contexts/SupeContext'

function Music() {
  const { mediaRef } = useSuper()
  const [audioEl, setAudioEl] = useState(null)

  useEffect(() => {
    // If mediaRef is populated, set it. Otherwise we wait.
    // In React, refs are populated after the initial render.
    if (mediaRef?.current && !audioEl) {
      setAudioEl(mediaRef.current)
    }
  }, [mediaRef, audioEl])

  return (
    <div className="Music">
      <div className="reproductor">

        <div >
          {audioEl ? (
            <Render audioElement={audioEl} width={500} height={400} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
export default Music
