function ModalHeader({ icon: Icon, label, title, description }) {
  return (
    <div>
      <span>
        <Icon /> {label}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

export default ModalHeader
