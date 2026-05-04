import { useEffect, useState } from 'react'
import './Background.scss'

function Background() {
  const [imageUrl, setImageUrl] = useState(() => {
    return localStorage.getItem('backgroundImageUrl') || ''
  })

  useEffect(() => {
    const handleStorageChange = () => {
      const newValue = localStorage.getItem('backgroundImageUrl')
      setImageUrl(newValue || '')
    }

    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(() => {
      const newValue = localStorage.getItem('backgroundImageUrl')
      if (newValue !== imageUrl) {
        setImageUrl(newValue || '')
      }
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [imageUrl])

  if (!imageUrl) return null

  return (
    <div className="background">
      <div
        className="background__image"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className="background__overlay" />
    </div>
  )
}

export default Background