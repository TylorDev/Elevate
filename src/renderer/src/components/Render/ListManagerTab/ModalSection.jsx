function ModalSection({ title, meta, children }) {
  return (
    <section className="list-manager-modal__section">
      <div className="list-manager-modal__section-header">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </section>
  )
}

export default ModalSection
