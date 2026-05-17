function EmptyMessage({ icon: Icon, title, description }) {
  return (
    <div>
      {Icon ? <Icon /> : null}
      <p>{title}</p>
      {description ? <small>{description}</small> : null}
    </div>
  )
}

export default EmptyMessage
