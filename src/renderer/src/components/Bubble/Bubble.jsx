import { useNavigate } from 'react-router-dom'
import './Bubble.scss'

export function Bubble({ children, text, number, url }) {
  const navigate = useNavigate()
  return (
    <div
      className="bubble"
      onClick={() => {
        navigate(url)
      }}
    >
      <div className="b-t">{text}</div>
      <div className="b-n">{number}</div>
      <div className="b-i">{children}</div>
    </div>
  )
}
