function EmptyMessage({ icon: Icon, title, description }) {
  return (
    <div className="list-manager-empty">
      {Icon ? (
        <div className="list-manager-empty__icon">
          <Icon />
        </div>
      ) : null}
      <div className="list-manager-empty__copy">
        <p>{title}</p>
        {description ? <small>{description}</small> : null}
      </div>
    </div>
  )
}

export default EmptyMessage
