import React, { useRef } from 'react'
import { HorizonList } from '../../components/HorizonList/HorizonList'
import { NavWheel } from '../../components/NavWheel/NavWheel'
import './Feed.scss'

function Feed() {
  const horizonRef = useRef(null)

  const handleScroll = (delta, isCircular) => {
    if (horizonRef.current) {
      horizonRef.current.scroll(delta, isCircular)
    }
  }

  return (
    <div className="Feed">
      <div className="feed-spacer" />

      <div className="feed-bottom-content">
        <div className="feed-header">
          <h2 className="feed-title">Más escuchadas</h2>
          <NavWheel onScroll={handleScroll} />
        </div>

        <HorizonList ref={horizonRef} />
      </div>
    </div>
  )
}

export default Feed
