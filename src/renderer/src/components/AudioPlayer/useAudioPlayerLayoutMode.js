import { useEffect, useState } from 'react'

export function getAudioPlayerLayoutMode() {
  if (typeof window === 'undefined') {
    return 'default'
  }

  if (window.innerWidth <= 484) {
    return 'tiny'
  }

  if (window.innerWidth <= 960) {
    return 'mid'
  }

  return 'default'
}

export function useAudioPlayerLayoutMode() {
  const [layoutMode, setLayoutMode] = useState(getAudioPlayerLayoutMode)

  useEffect(() => {
    const handleResize = () => {
      setLayoutMode(getAudioPlayerLayoutMode())
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return layoutMode
}
