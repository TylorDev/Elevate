import './CollectionHero.scss'

function joinClassNames(parts) {
  return parts.filter(Boolean).join(' ')
}

export function CollectionHero({
  variant = 'collection',
  media = null,
  eyebrow = '',
  title,
  description = '',
  meta = null,
  actions = null,
  signal = null,
  className = ''
}) {
  const hasMedia = Boolean(media)
  const hasSignal = Boolean(signal)

  return (
    <header
      className={joinClassNames([
        'collection-hero',
        `collection-hero--${variant}`,
        hasMedia ? 'collection-hero--with-media' : '',
        hasSignal ? 'collection-hero--with-signal' : '',
        className
      ])}
    >
      {hasMedia ? <div className="collection-hero__media">{media}</div> : null}

      <div className="collection-hero__body">
        <h1>{title}</h1>

        {meta ? <div className="collection-hero__meta">{meta}</div> : null}
        {actions ? <div className="collection-hero__actions">{actions}</div> : null}
      </div>
    </header>
  )
}

export default CollectionHero
