import { useState } from 'react'
import './Modal.scss'

const Modal = ({ isVisible, closeModal, children }) => {
  const modalStyle = {
    width: '300px',
    height: '300px',

    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    padding: '20px',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 5000,
    display: isVisible ? 'flex' : 'none'
  }

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 4999,
    display: isVisible ? 'block' : 'none'
  }

  return (
    <>
      <div style={overlayStyle} onClick={closeModal} />

      <div style={modalStyle}>
        <button onClick={closeModal} style={{ position: 'absolute', top: '10px', right: '10px' }}>
          X
        </button>
        {children}
      </div>
    </>
  )
}

export default Modal
