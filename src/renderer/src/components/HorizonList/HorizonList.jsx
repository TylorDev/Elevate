import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useMini } from '../../Contexts/MiniContext'
import { TrackCard } from '../TrackCard/TrackCard'
import './HorizonList.scss'

// eslint-disable-next-line react/display-name
export const HorizonList = forwardRef((props, ref) => {
  const { most, getMost } = useMini()
  const listRef = useRef(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)

  useEffect(() => {
    getMost()
  }, [])

  const topTracks = most.slice(0, 20)

  // Medir el ancho de la tarjeta dinámicamente
  useEffect(() => {
    const measureCard = () => {
      if (listRef.current) {
        const card = listRef.current.querySelector('.track-card')
        if (card) {
          const style = getComputedStyle(listRef.current)
          const gap = parseFloat(style.gap) || 8
          setCardWidth(card.offsetWidth + gap)
        }
      }
    }
    measureCard()
    window.addEventListener('resize', measureCard)
    return () => window.removeEventListener('resize', measureCard)
  }, [topTracks.length])

  // Efecto de scroll basado en focusedIndex
  useEffect(() => {
    if (listRef.current && topTracks.length > 0 && cardWidth > 0) {
      const targetScroll = focusedIndex * cardWidth
      
      // Si el cambio es brusco (del último al primero o viceversa), usamos scroll instantáneo
      const isWrapJump = Math.abs(listRef.current.scrollLeft - targetScroll) > cardWidth * 2

      listRef.current.scrollTo({
        left: targetScroll,
        behavior: isWrapJump ? 'auto' : 'smooth'
      })
    }
  }, [focusedIndex, topTracks.length, cardWidth])

  useImperativeHandle(ref, () => ({
    scroll: (delta, isCircular = false) => {
      if (topTracks.length === 0) return
      
      setFocusedIndex(prev => {
        let next = prev + delta
        
        if (isCircular) {
          // Lógica circular para botones
          if (next >= topTracks.length) return 0
          if (next < 0) return topTracks.length - 1
          return next
        } else {
          // Lógica lineal para la rueda
          return Math.max(0, Math.min(next, topTracks.length - 1))
        }
      })
    }
  }))

  return (
    <div className="horizon-viewport">
      <div className="horizon-container" ref={listRef}>
        {topTracks.map((song, i) => (
          <TrackCard
            key={`${song.filePath}-${i}`}
            song={song}
            index={i}
            list={topTracks}
            isFocused={i === focusedIndex}
          />
        ))}
        {topTracks.length === 0 && (
          <p className="no-data">No hay datos de reproducción aún.</p>
        )}
      </div>
    </div>
  )
})
