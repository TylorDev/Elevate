import { useBackground } from '../../Contexts/BackgroundContext'
import './Background.scss'

function Background() {
  const { backgroundImageUrl: imageUrl } = useBackground()

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
