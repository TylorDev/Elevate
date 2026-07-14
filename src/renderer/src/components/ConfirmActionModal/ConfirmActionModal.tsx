import Modal from '../Modal/Modal'
import './ConfirmActionModal.scss'

export function ConfirmActionModal({
  isVisible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
  isDanger = true
}) {
  const handleConfirm = () => {
    onCancel?.()
    window.setTimeout(() => {
      onConfirm?.()
    }, 0)
  }

  return (
    <Modal isVisible={isVisible} closeModal={onCancel} contentClassName="confirm-action-modal">
      <div className="confirm-action-modal__body">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-action-modal__actions">
          <button type="button" className="confirm-action-modal__button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              isDanger
                ? 'confirm-action-modal__button is-danger'
                : 'confirm-action-modal__button is-primary'
            }
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmActionModal
