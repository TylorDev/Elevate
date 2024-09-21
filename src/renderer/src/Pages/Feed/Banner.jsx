import './Banner.scss'

export function Banner(gridArea) {
  return (
    <div className="banner" style={gridArea ? { gridArea } : {}}>
      <div>
        <img
          src="https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif"
          alt="no foto"
        />
      </div>
    </div>
  )
}
