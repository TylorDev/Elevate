import './Card.scss'

function Card({ children, className = '', header = null }) {
  const classNames = ['preset-card', className].filter(Boolean).join(' ')

  return (
    <section className={classNames}>
      {header ? <div className="preset-card__header">{header}</div> : null}
      <div className="preset-card__body">{children}</div>
    </section>
  )
}

export default Card
