/* eslint-disable react/prop-types */
import './AudioPlayer.scss'

import { MediaTimeDisplay } from '../MediaTimeDisplay/MediaTimeDisplay'
import { Controls } from '../Controls/Controls'

import { Metadata } from './Metadata'

export function AudioPlayer() {
  return (
    <div className="AudioPlayer" id="AudioPlayer">
      <Metadata />

      <Controls />

      <MediaTimeDisplay />
    </div>
  )
}
