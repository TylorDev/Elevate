import { Link } from 'react-router-dom'

export function SuperLink({ name, desc, url }) {
  return (
    <div className="hx">
      <span>{name} </span>
      <Link to={url}>{desc}</Link>
    </div>
  )
}
