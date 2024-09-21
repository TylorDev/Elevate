import { SuperLink } from './SuperLink'
import './Section.scss'

export function Section({ children, name, to, desc = 'Explore more' }) {
  return (
    <section className="section">
      <SuperLink name={name} url={to} desc={desc} />
      {children}
    </section>
  )
}
