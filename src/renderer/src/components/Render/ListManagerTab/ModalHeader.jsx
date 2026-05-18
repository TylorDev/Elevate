function ModalHeader({ icon: Icon, label, title, description }) {
  return (
    <div className="list-manager-modal__header">
      <span className="list-manager-modal__eyebrow">
        <Icon /> {label}
      </span>
      <h3 className="list-manager-modal__title">{title}</h3>
      <p className="list-manager-modal__description">{description}</p>
    </div>
  )
}

export default ModalHeader
