import { useEffect, useRef, useState } from 'react'
import './DebugOverlay.scss'

const CTRL_DOUBLE_PRESS_MS = 400

const DebugOverlay = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })
  const [position, setPosition] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  })
  const [isHovered, setIsHovered] = useState(false)
  const [isMoveMode, setIsMoveMode] = useState(false)
  const lastCtrlPressRef = useRef(0)

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setDimensions({
        width,
        height
      })
      setPosition((current) => ({
        x: Math.min(Math.max(current.x, 0), width),
        y: Math.min(Math.max(current.y, 0), height)
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Control' || event.repeat || !isHovered) {
        return
      }

      const now = Date.now()
      const isDoublePress = now - lastCtrlPressRef.current <= CTRL_DOUBLE_PRESS_MS
      lastCtrlPressRef.current = now

      if (isDoublePress) {
        setIsMoveMode((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHovered])

  useEffect(() => {
    if (!isMoveMode) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMoveMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMoveMode])

  const handleMoveOverlay = (event) => {
    if (!isMoveMode) {
      return
    }

    setPosition({
      x: event.clientX,
      y: event.clientY
    })
    setIsMoveMode(false)
  }

  return (
    <div
      className={`debug-overlay${isMoveMode ? ' debug-overlay--move-mode' : ''}`}
      onClick={handleMoveOverlay}
    >
      <div
        className="debug-overlay__content"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      >
        <span className="debug-overlay__label">WIDTH</span>
        <span className="debug-overlay__value">{dimensions.width}px</span>
        <div className="debug-overlay__divider" />
        <span className="debug-overlay__label">HEIGHT</span>
        <span className="debug-overlay__value">{dimensions.height}px</span>
      </div>
    </div>
  )
}

export default DebugOverlay
