import { useEffect, useState } from 'react'
import './Feed.scss'

function Feed() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)

    // Añade el evento de redimensionamiento
    window.addEventListener('resize', handleResize)

    // Limpia el evento cuando el componente se desmonta
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <div className="grid-container">
      <div className="grid-item item1">1</div>
      <div className="grid-item item2">2</div>

      <div className="grid-item item4">{screenWidth}</div>

      <div className="grid-item item6">6</div>
      <div className="grid-item item7">7</div>
      <div className="grid-item item8">extra</div>
    </div>
  )
}
export default Feed
