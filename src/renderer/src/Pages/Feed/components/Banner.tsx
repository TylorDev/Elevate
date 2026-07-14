
import './Banner.scss'
import { useEffect, useState } from 'react'
import banner from './../../../assets/banner.png'
export function Banner(gridArea) {
  // Estado para manejar la URL de la imagen
  const [storedImageUrl, setStoredImageUrl] = useState(null)

  // Al montar el componente, obtener la URL desde localStorage y guardarla en el estado
  useEffect(() => {
    const savedImageUrl = localStorage.getItem('bannerImageUrl')
    if (savedImageUrl) {
      setStoredImageUrl(savedImageUrl)
    } else {
      setStoredImageUrl(banner)
    }
  }, [])
  return (
    <div className="banner" style={gridArea ? { gridArea } : {}}>
      <div>
        <img src={storedImageUrl} alt="no foto" />
      </div>
    </div>
  )
}
