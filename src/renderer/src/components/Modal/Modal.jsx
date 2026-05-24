import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import './Modal.scss'

const Modal = ({ isVisible, closeModal, children, contentClassName = '' }) => {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return undefined
    }

    if (isVisible) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }

    return undefined
  }, [isVisible])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={contentClassName ? `modalStyle ${contentClassName}` : 'modalStyle'}
      onCancel={(event) => {
        event.preventDefault()
        closeModal()
      }}
      onClick={(event) => {
        const dialog = dialogRef.current

        if (!dialog) {
          return
        }

        const bounds = dialog.getBoundingClientRect()
        const isInsideDialog =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom

        if (!isInsideDialog) {
          closeModal()
        }
      }}
    >
      <button
        type="button"
        onClick={closeModal}
        className="modalStyle__close"
        aria-label="Cerrar modal"
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="modalStyle__content">{children}</div>
    </dialog>,
    document.body
  )
}

export default Modal
