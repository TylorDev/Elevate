import React, { useRef, useState, useEffect } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import './NavWheel.scss'

export function NavWheel({ onScroll }) {
  const wheelRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [rotation, setRotation] = useState(0)

  const handleWheel = (e) => {
    // Up = Left, Down = Right
    const delta = e.deltaY > 0 ? 1 : -1
    onScroll(delta)
    setRotation(prev => prev + (delta * 20))
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setStartY(e.clientY)
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const deltaY = e.clientY - startY
    if (Math.abs(deltaY) > 10) {
      const delta = deltaY > 0 ? 1 : -1
      onScroll(delta)
      setRotation(prev => prev + (delta * 10))
      setStartY(e.clientY)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isDragging, startY])

  return (
    <div className="nav-wheel-container">
      <button className="nav-btn" onClick={() => onScroll(-1)}>
        <LuChevronLeft />
      </button>

      <div 
        className={`nav-wheel ${isDragging ? 'dragging' : ''}`}
        ref={wheelRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="wheel-inner" 
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="wheel-mark" 
              style={{ transform: `rotate(${i * 30}deg) translateY(-18px)` }}
            />
          ))}
        </div>
        <div className="wheel-center" />
      </div>

      <button className="nav-btn" onClick={() => onScroll(1)}>
        <LuChevronRight />
      </button>
    </div>
  )
}
