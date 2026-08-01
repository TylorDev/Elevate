/* eslint-disable @typescript-eslint/no-explicit-any */
import styles from './PresetCard.module.scss'

function PresetCard({ children, className = '', header = null }: any) {
  const classNames = [styles.root, 'preset-card', className].filter(Boolean).join(' ')

  return (
    <section className={classNames}>
      {header ? <div className="preset-card__header">{header}</div> : null}
      <div className="preset-card__body">{children}</div>
    </section>
  )
}

export default PresetCard
