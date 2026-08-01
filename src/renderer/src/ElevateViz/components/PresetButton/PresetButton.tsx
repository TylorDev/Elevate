/* eslint-disable @typescript-eslint/no-explicit-any */
import styles from './PresetButton.module.scss'

function PresetButton({
  children,
  className = '',
  disabled = false,
  onClick,
  title,
  type = 'button',
  variant = 'default'
}: any) {
  const classNames = [styles.root, 'preset-button', `preset-button--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classNames} disabled={disabled} onClick={onClick} title={title} type={type}>
      {children}
    </button>
  )
}

export default PresetButton
