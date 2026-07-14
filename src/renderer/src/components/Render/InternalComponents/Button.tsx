import './Button.scss'

function Button({
  children,
  className = '',
  disabled = false,
  onClick,
  title,
  type = 'button',
  variant = 'default'
}) {
  const classNames = ['preset-button', `preset-button--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classNames}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type={type}
    >
      {children}
    </button>
  )
}

export default Button
