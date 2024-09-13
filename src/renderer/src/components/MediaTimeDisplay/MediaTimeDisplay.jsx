/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'

import './MediaTimeDisplay.scss'

import { useSuper } from '../../Contexts/SupeContext'

export const MediaTimeDisplay = () => {
  const { progress, duration, handleTimelineClick } = useSuper()

  return (
    <div className="timeline">
      <div>
        {Math.floor(progress / 60)}:
        {Math.floor(progress % 60)
          .toString()
          .padStart(2, '0')}{' '}
      </div>

      <Timeline handleTimelineClick={handleTimelineClick} progress={progress} duration={duration} />
      <div>
        /{Math.floor(duration / 60)}:
        {Math.floor(duration % 60)
          .toString()
          .padStart(2, '0')}
      </div>
    </div>
  )
}

function Timeline({ handleTimelineClick, progress, duration }) {
  return (
    <div id="Otimeline" onClick={handleTimelineClick}>
      <div
        id="Itimeline"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${(progress / duration) * 100}%`
        }}
      />
    </div>
  )
}
