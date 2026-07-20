import type { ReactNode } from 'react'
import styles from './VizShell.module.scss'

interface VizShellProps {
  children: ReactNode
  className?: string
}

export function VizShell({ children, className = '' }: VizShellProps) {
  return (
    <div className={`${styles.root} ${className}`.trim()} data-elevate-viz-root="">
      {children}
    </div>
  )
}
