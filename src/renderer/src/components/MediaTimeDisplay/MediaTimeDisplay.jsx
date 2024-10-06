/* eslint-disable react/prop-types */

import './MediaTimeDisplay.scss'

import { useSuper } from '../../Contexts/SupeContext'
import { LinearProgress } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

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
  const [progresss, setProgresss] = useState(0)
  const [buffer, setBuffer] = useState(10)

  const progressRef = useRef(() => {})

  useEffect(() => {
    progressRef.current = () => {
      if (progresss === 100) {
        setProgresss(0)
        setBuffer(10)
      } else {
        setProgresss((prev) => prev + 1)
        if (buffer < 100 && progresss % 5 === 0) {
          const newBuffer = buffer + 1 + Math.random() * 10
          setBuffer(newBuffer > 100 ? 100 : newBuffer)
        }
      }
    }
  }, [progresss, buffer]) // Añadir dependencias para asegurar que el efecto se ejecute correctamente

  useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current()
    }, 100)

    return () => {
      clearInterval(timer)
    }
  }, [])

  if (!duration) {
    return (
      <div id="Otimeline" className="LoadTimeLine">
        <LinearProgress variant="buffer" value={progresss} valueBuffer={buffer} />
      </div>
    )
  }

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
