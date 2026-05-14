import { createPortal } from 'react-dom'
import './Modal.scss'

const Modal = ({ isVisible, closeModal, children, contentClassName = '' }) => {
  if (typeof document === 'undefined') {
    return null
  }

  const modalStyle = {
    display: isVisible ? 'flex' : 'none'
  }

  const overlayStyle = {
    display: isVisible ? 'block' : 'none'
  }

  return createPortal(
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
    </>,
    document.body
  )
}

export default Modal
