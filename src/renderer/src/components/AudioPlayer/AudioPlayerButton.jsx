import './AudioPlayerButton.scss'

export function AudioPlayerButton({
  children,
  onClick,
  className = '',
  variant = 'default',
  ariaLabel,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`AudioPlayerButton AudioPlayerButton--${variant} ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
