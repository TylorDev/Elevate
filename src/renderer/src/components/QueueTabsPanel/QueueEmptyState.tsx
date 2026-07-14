import './QueueEmptyState.scss'

function QueueEmptyState({ icon, title, description, actionLabel, actionIcon, onAction, disabled }) {
  return (
    <div className="QueueEmptyState">
      {icon ? <div className="QueueEmptyState__icon">{icon}</div> : null}
      <div className="QueueEmptyState__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="QueueEmptyState__action"
          onClick={onAction}
          disabled={disabled}
        >
          {actionIcon}
          <span>{actionLabel}</span>
        </button>
      ) : null}
    </div>
  )
}

export default QueueEmptyState
