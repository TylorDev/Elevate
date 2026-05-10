import './Modal.scss'

const Modal = ({ isVisible, closeModal, children, contentClassName = '' }) => {
  const modalStyle = {
    display: isVisible ? 'flex' : 'none'
  }

  const overlayStyle = {
    display: isVisible ? 'block' : 'none'
  }

  return (
    <>
      <div style={overlayStyle} className="overlayStyle" onClick={closeModal} />

      <div
        style={modalStyle}
        className={contentClassName ? `modalStyle ${contentClassName}` : 'modalStyle'}
      >
        <button
          onClick={(event) => {
            event.stopPropagation()
            closeModal()
          }}
          className="btn-close"
        >
          X
        </button>
        {children}
      </div>
    </>
  )
}

export default Modal
