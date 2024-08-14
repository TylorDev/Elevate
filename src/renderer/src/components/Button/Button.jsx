import './Button.scss'

export function Button({ children, ...props }) {
  return (
    <button id="Button" {...props}>
      {children}
    </button>
  )
}
