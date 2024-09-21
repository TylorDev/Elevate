import './Modal.scss'

const Modal = ({ isVisible, closeModal, children }) => {
  const modalStyle = {
    display: isVisible ? 'flex' : 'none'
  }

  const overlayStyle = {
    display: isVisible ? 'block' : 'none'
  }

  return (
    <>
      <div style={overlayStyle} className="overlayStyle" onClick={closeModal} />

      <div style={modalStyle} className="modalStyle">
        <button onClick={closeModal} className="btn-close">
          X
        </button>
        {children}
      </div>
    </>
  )
}

export default Modal
