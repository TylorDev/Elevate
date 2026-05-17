function ModalSection({ title, meta, children }) {
  return (
    <section>
      <div>
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </section>
  )
}

export default ModalSection
