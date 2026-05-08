import { useEffect, useState } from 'react'
import './Music.scss'


import Render from '../../components/Render/Render'
import RenderControls from '../../components/Render/RenderControls'
import { useVisualizerPresets } from '../../components/Render/useVisualizerPresets'
import { useSuper } from '../../Contexts/SupeContext'

function Music() {
  const { mediaRef } = useSuper()
  const [audioEl, setAudioEl] = useState(null)

  const presetControls = useVisualizerPresets()

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
            <Render
              audioElement={audioEl}
              height={400}
              presetName={presetControls.currentPresetName}
            />
          ) : null}
        </div>

        {/* RenderControls is placed here outside of Render, making it optional and flexible */}
        <RenderControls
          currentPresetName={presetControls.currentPresetName}
          isPresetPaused={presetControls.isPresetPaused}
          onNext={presetControls.nextPreset}
          onPrev={presetControls.prevPreset}
          onTogglePause={presetControls.togglePresetPause}
        />

      </div>
    </div>
  )
}
export default Music
