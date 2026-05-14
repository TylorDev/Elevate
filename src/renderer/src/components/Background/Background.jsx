import { useSuper } from '../../Contexts/SupeContext'
import './Background.scss'

function Background() {
  const { backgroundImageUrl: imageUrl } = useSuper()

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
