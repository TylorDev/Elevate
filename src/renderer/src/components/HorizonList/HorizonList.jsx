import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useMini } from '../../Contexts/MiniContext'
import { TrackCard } from '../TrackCard/TrackCard'
import './HorizonList.scss'

export const HorizonList = forwardRef((props, ref) => {
  const { most, getMost } = useMini()
  const listRef = useRef(null)

  useEffect(() => {
    getMost()
  }, [])

  const topTracks = most.slice(0, 20)
  const displayTracks = [...topTracks, ...topTracks, ...topTracks]
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    if (topTracks.length > 0 && focusedIndex === 0) {
      setFocusedIndex(topTracks.length)
    }
  }, [topTracks.length])

  useEffect(() => {
    if (listRef.current && topTracks.length > 0) {
      // If we are at the very beginning or end of our triple list, jump to middle set instantly
      const isWrapForward = focusedIndex >= topTracks.length * 2
      const isWrapBackward = focusedIndex < topTracks.length

      if (isWrapForward || isWrapBackward) {
        const newIndex = isWrapForward 
          ? focusedIndex - topTracks.length 
          : focusedIndex + topTracks.length
        
        // Instant jump
        listRef.current.scrollTo({
          left: newIndex * 216,
          behavior: 'auto'
        })
        setFocusedIndex(newIndex)
      } else {
        // Smooth scroll for normal movement
        listRef.current.scrollTo({
          left: focusedIndex * 216,
          behavior: 'smooth'
        })
      }
    }
  }, [focusedIndex, topTracks.length])

  useImperativeHandle(ref, () => ({
    scroll: (delta) => {
      if (topTracks.length === 0) return
      setFocusedIndex(prev => prev + delta)
    }
  }))

  return (
    <div className="horizon-viewport">
      <div 
        className="horizon-container" 
        ref={listRef}
      >
        {displayTracks.map((song, i) => {
          const actualIndex = i % topTracks.length
          return (
            <TrackCard 
              key={`${song.filePath}-${i}`} 
              song={song} 
              index={actualIndex} 
              list={topTracks}
              isFocused={i === focusedIndex} 
            />
          )
        })}
        {topTracks.length === 0 && (
          <p className="no-data">No hay datos de reproducción aún.</p>
        )}
      </div>
    </div>
  )
})
